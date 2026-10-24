/** Pipeline v6 A. Local DB must already include A. Never resets/applies migrations. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { run, q, scalar, service, denied, openTransaction } from "./helpers/pipeline-v6-db.mjs";

const domain = randomUUID(), ids = Array.from({ length: 9 }, () => randomUUID());
const vectors = JSON.parse(readFileSync("content-pipeline/tests/fixtures/content_hash_vectors.json", "utf8"));
const hash = id => scalar(`SELECT public.question_content_sha256(${q(id)})`);
const publish = (id, h, payload = {}) => `SELECT public.publish_question(${q(id)},${q(h)},'pipeline-verifier',${q(JSON.stringify(payload))}::jsonb)`;
const quarantine = id => `SELECT public.quarantine_question(${q(id)},'test','pipeline-verifier')`;
const retire = (id, h, payload = {}) => `SELECT public.retire_question(${q(id)},'test','pipeline-verifier',${q(JSON.stringify(payload))}::jsonb,${q(h)})`;
const restore = (id, h, payload = {}) => `SELECT public.restore_question(${q(id)},${q(h)},'pipeline-verifier',${q(JSON.stringify(payload))}::jsonb)`;
const result = async sql => JSON.parse(await scalar(service(sql)));
try {
  assert.equal(await scalar("SELECT relrowsecurity FROM pg_class WHERE oid='public.question_events'::regclass"), "t");
  assert.equal(await scalar("SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='question_events'"), "0");
  for (const role of ["anon", "authenticated"]) {
    await denied(`BEGIN; SET LOCAL ROLE ${role}; SELECT * FROM public.question_events; ROLLBACK`, /permission denied/);
    for (const signature of ["publish_question(uuid,text,text,jsonb)", "quarantine_question(uuid,text,text,jsonb,text)",
      "restore_question(uuid,text,text,jsonb)", "retire_question(uuid,text,text,jsonb,text)",
      "transition_question(uuid,text,text,text,text,jsonb)","question_content_sha256(uuid)","lock_question_lifecycle(uuid)"]) {
      assert.equal(await scalar(`SELECT has_function_privilege(${q(role)},${q('public.'+signature)},'EXECUTE')`), "f");
    }
  }
  await run(`INSERT INTO public.exam_domains(id,exam,code,name) VALUES(${q(domain)},'GCP_PM_ML_ENG',${q('PIPELINE-'+domain)},'Isolated pipeline verifier')`);
  for (const [index,id] of ids.entries()) {
    const vector = vectors[index < vectors.length ? index : 0];
    await run(`INSERT INTO public.questions(id,exam,domain_id,stem,status,review_status) VALUES(${q(id)},'GCP_PM_ML_ENG',${q(domain)},${q(vector.stem)},'DRAFT','GOOD')`);
    for (const [i,a] of vector.answers.entries()) {
      await run(`INSERT INTO public.answers(question_id,choice_label,choice_text,explanation_text,is_correct) VALUES(${q(id)},${q('ABCD'[i])},${q(a.choice_text)},${a.explanation_text===null?'NULL':q(a.explanation_text)},${a.is_correct})`);
    }
    assert.equal(await hash(id), vector.sha256, vector.name + ' SQL/Python parity');
  }
  const id = ids[3], h = await hash(id);
  await denied(service(publish(id, '0'.repeat(64))), /content hash mismatch/);
  await denied(service(publish(id, h, { expected_revision: 2 })), /revision changed/);
  await denied(service(publish(ids[2], await hash(ids[2]))), /publication integrity/);
  assert.equal(await scalar(`SELECT count(*) FROM public.question_events WHERE question_id=${q(id)}`), '0', 'failed publish writes no event');
  // Same question simultaneous publish: exactly one changes the row/event.
  const publications = await Promise.all([run(service(publish(id,h)),true),run(service(publish(id,h)),true)]);
  assert.equal(publications.filter(r=>r.code===0).length,1);
  assert.equal(await scalar(`SELECT count(*) FROM public.question_events WHERE question_id=${q(id)} AND action='published'`),'1');
  await denied(service(`UPDATE public.answers SET explanation_text='Changed' WHERE question_id=${q(id)}`), /Withdraw question/);
  await denied(service(`UPDATE public.questions SET stem='Changed' WHERE id=${q(id)}`), /Withdraw question/);
  await run(service(`UPDATE public.answers SET choice_label=choice_label||'X' WHERE question_id=${q(id)}`));
  assert.equal(await scalar(`SELECT revision FROM public.questions WHERE id=${q(id)}`),'1','labels do not create revisions');
  assert.equal(await hash(id),h,'labels do not change hash');
  await run(service(`UPDATE public.questions SET stem=stem||' edited' WHERE id=${q(ids[0])}`));
  assert.equal(await scalar(`SELECT revision FROM public.questions WHERE id=${q(ids[0])}`),'2','draft stem edit advances revision');
  // A pending child-content write owns the parent lock. Publication must wait
  // and recompute the committed content, rather than accepting the old hash.
  const staleHash = await hash(ids[0]);
  const editor = await openTransaction(`UPDATE public.answers SET explanation_text=explanation_text||' race' WHERE question_id=${q(ids[0])} AND is_correct`);
  const waitingPublisher = run(service(publish(ids[0],staleHash)),true);
  editor.release();
  await editor.completed;
  const stalePublish = await waitingPublisher;
  assert.notEqual(stalePublish.code,0);
  assert.match(stalePublish.error,/content hash mismatch/);
  assert.equal(await scalar(`SELECT status FROM public.questions WHERE id=${q(ids[0])}`),'DRAFT');
  // Create exactly four original ACTIVE questions; two removals race on different rows.
  for (const activeId of ids.slice(4,7)) await run(service(publish(activeId,await hash(activeId))));
  const withdrawals = await Promise.all([result(quarantine(ids[3])),result(quarantine(ids[4]))]);
  assert.deepEqual(withdrawals.map(r=>r.outcome).sort(), ['changed','floor_blocked']);
  assert.equal(await scalar(`SELECT count(*) FROM public.questions WHERE domain_id=${q(domain)} AND status='ACTIVE' AND parent_question_id IS NULL`),'3');
  const quarantined = withdrawals[0].changed ? ids[3] : ids[4];
  const active = withdrawals[0].changed ? ids[4] : ids[3];
  assert.equal((await result(retire(active,await hash(active)))).outcome,'floor_blocked');
  const cycle = await scalar(`SELECT id FROM public.question_events WHERE question_id=${q(quarantined)} AND action='quarantined' ORDER BY at DESC LIMIT 1`);
  await denied(service(restore(quarantined,await hash(quarantined), {quarantine_event_id:randomUUID()})),/quarantine cycle changed/);
  await run(service(restore(quarantined,await hash(quarantined), {quarantine_event_id:cycle,revision:1})));
  // Restored then reported again: old cycle cannot authorize the new quarantine.
  await run(service(quarantine(quarantined)));
  await denied(service(restore(quarantined,await hash(quarantined),{quarantine_event_id:cycle})),/quarantine cycle changed/);
  // Stale council retirement refuses any changed explanation, even same stem/key.
  const oldHash = await hash(quarantined);
  await run(service(`UPDATE public.answers SET explanation_text=explanation_text||' changed' WHERE question_id=${q(quarantined)} AND is_correct`));
  assert.equal(await scalar(`SELECT revision FROM public.questions WHERE id=${q(quarantined)}`),'2','quarantined answer edit advances revision');
  assert.equal(await scalar(`SELECT content_sha256 IS NULL FROM public.questions WHERE id=${q(quarantined)}`),'t','edit invalidates cached hash');
  await denied(service(retire(quarantined,oldHash)),/content hash mismatch/);
  await run(service(retire(quarantined,await hash(quarantined))));
  // Atomic draft-only legacy eligibility must not retire a concurrently published row.
  await denied(service(retire(active,await hash(active),{expected_status:'DRAFT',expected_exam:'GCP_PM_ML_ENG',expected_created_before:'2100-01-01T00:00:00Z'})),/retirement eligibility changed/);
  // Publish and removal share the domain lock. Neither interleaving breaks floor.
  const race = await Promise.all([run(service(publish(ids[7],await hash(ids[7])))),result(quarantine(active))]);
  assert.equal(race[0].code,0);
  assert.ok(Number(await scalar(`SELECT count(*) FROM public.questions WHERE domain_id=${q(domain)} AND status='ACTIVE' AND parent_question_id IS NULL`))>=3);
  // A concurrent family edit cannot sneak a variant through an original-only
  // publisher. The parent metadata is checked AFTER acquiring the row lock.
  const originalHash = await hash(ids[8]);
  const familyEditor = await openTransaction(`UPDATE public.questions SET parent_question_id=${q(active)} WHERE id=${q(ids[8])}`);
  const waitingVariantPublisher = run(service(publish(ids[8],originalHash)),true);
  familyEditor.release();
  await familyEditor.completed;
  const variantPublish = await waitingVariantPublisher;
  assert.notEqual(variantPublish.code,0);
  assert.match(variantPublish.error,/Only original questions may publish/);
  await denied(service(publish(ids[8],await hash(ids[8]))),/Only original questions may publish/);
  assert.equal(await scalar(`SELECT count(*) FROM public.question_events WHERE question_id=${q(ids[8])} AND action='published'`),'0');
  // Already-approved legacy variants can still withdraw and restore. This fixture
  // uses an administrator-only setup write, not the original-only publish RPC.
  await run(`UPDATE public.questions SET status='ACTIVE',content_sha256=public.question_content_sha256(id) WHERE id=${q(ids[8])}`);
  assert.equal((await result(quarantine(ids[8]))).changed,true);
  assert.equal((await result(restore(ids[8],await hash(ids[8])))).changed,true);
  console.log('PASS pipeline v6 A: shared SQL/Python UTF8 hashes; service-only ACL/RLS; integrity/hash/revision/cycle fences; answer immutability; concurrent publish/withdraw/floor; variants; legacy eligibility');
} finally {
  await run(`DELETE FROM public.question_events WHERE question_id IN (${ids.map(q).join(',')});
    UPDATE public.questions SET status='RETIRED' WHERE domain_id=${q(domain)};
    DELETE FROM public.questions WHERE domain_id=${q(domain)} AND parent_question_id IS NOT NULL;
    DELETE FROM public.questions WHERE domain_id=${q(domain)};
    DELETE FROM public.exam_domains WHERE id=${q(domain)};`);
}
