/** Pipeline v6 A. Local DB must already include A. Never resets/applies migrations.
 * Trusted fixture UPDATEs explicitly set the local lifecycle flag in their own
 * transaction. RPC regressions deliberately do not inherit that fixture flag.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { run, q, scalar, service, denied, openTransaction } from "./helpers/pipeline-v6-db.mjs";

const domain = randomUUID(), ids = Array.from({ length: 9 }, () => randomUUID());
const familyDomain = randomUUID(), crossDomain = randomUUID();
const family = Array.from({length: 9},()=>randomUUID());
const ingest = Array.from({length: 3},()=>randomUUID()), runId = randomUUID();
const reviewNotes = '{"fixture":"pending-ingest"}';
const finalize = (id,status='GOOD',run=runId,notes=reviewNotes) =>
  `SELECT public.finalize_question_review(${q(id)},${q(run)},${q(status)},${q(notes)})`;
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
    // Custom GUCs are not privilege barriers. A browser role can set one but
    // still cannot call a lifecycle function or write questions directly.
    await denied(`BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('testero.lifecycle','1',true);
      SELECT public.publish_question(${q(ids[0])},${q('0'.repeat(64))},'untrusted'); ROLLBACK`, /permission denied/);
    await denied(`BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('testero.lifecycle','1',true);
      UPDATE public.questions SET status='ACTIVE' WHERE id=${q(ids[0])}; ROLLBACK`, /permission denied/);
    for (const signature of ["publish_question(uuid,text,text,jsonb)", "quarantine_question(uuid,text,text,jsonb,text)",
      "restore_question(uuid,text,text,jsonb)", "retire_question(uuid,text,text,jsonb,text)",
      "transition_question(uuid,text,text,text,text,jsonb)","finalize_question_review(uuid,uuid,text,text)","question_content_sha256(uuid)","lock_question_lifecycle(uuid)"]) {
      assert.equal(await scalar(`SELECT has_function_privilege(${q(role)},${q('public.'+signature)},'EXECUTE')`), "f");
    }
  }
  await run(`INSERT INTO public.exam_domains(id,exam,code,name) VALUES(${q(domain)},'GCP_PM_ML_ENG',${q('PIPELINE-'+domain)},'Isolated pipeline verifier')`);
  // Normal ingestion stages an UNREVIEWED draft, then answers/explanation,
  // then finalizes via the SAME lifecycle transition. GOOD is not publication.
  await run(`INSERT INTO public.question_generation_runs(id,exam,domain_code,target_count,model)
    VALUES(${q(runId)},'GCP_PM_ML_ENG','PIPELINE',3,'offline-fixture')`);
  for (const [i,iid] of ingest.entries()) {
    await run(service(`INSERT INTO public.questions(id,exam,domain_id,stem,status,review_status,generation_run_id,review_notes)
      VALUES(${q(iid)},'GCP_PM_ML_ENG',${q(domain)},'Ingest verifier','DRAFT','UNREVIEWED',${q(runId)},${q(reviewNotes)})`));
    if (i===0) await denied(service(finalize(iid)),/publication integrity/);
    await run(service(`INSERT INTO public.answers(question_id,choice_label,choice_text,explanation_text,is_correct)
      SELECT ${q(iid)},x,x,CASE WHEN ${i}=2 AND x='D' THEN '' ELSE 'Explanation '||x END,x='A'
      FROM unnest(ARRAY['A','B','C','D']) x;
      INSERT INTO public.explanations(question_id,explanation_text) VALUES(${q(iid)},'Combined rationale')`));
  }
  await denied(service(finalize(ingest[0],'GOOD',randomUUID())),/review finalization eligibility/);
  await denied(service(finalize(ingest[0],'GOOD',runId,'changed notes')),/review finalization eligibility/);
  await denied(service(finalize(ingest[0],'ACTIVE')),/review finalization eligibility/);
  await denied(service(finalize(ingest[2])),/publication integrity/);
  const finalized = await result(finalize(ingest[0]));
  assert.equal(finalized.changed,true);
  assert.equal(await scalar(`SELECT status||':'||review_status FROM public.questions WHERE id=${q(ingest[0])}`),'DRAFT:GOOD');
  assert.equal(await scalar(`SELECT count(*) FROM public.question_events WHERE question_id=${q(ingest[0])} AND action='reviewed'`),'1');
  await denied(service(finalize(ingest[0])),/review finalization eligibility/);
  await run(service(finalize(ingest[1],'NEEDS_ANSWER_FIX')));
  assert.equal(await scalar(`SELECT status||':'||review_status FROM public.questions WHERE id=${q(ingest[1])}`),'DRAFT:NEEDS_ANSWER_FIX');
  await denied(service(finalize(ingest[1],'GOOD')),/review finalization eligibility/);
  for (const [index,id] of ids.entries()) {
    const vector = vectors[index < vectors.length ? index : 0];
    await run(`INSERT INTO public.questions(id,exam,domain_id,stem,status,review_status) VALUES(${q(id)},'GCP_PM_ML_ENG',${q(domain)},${q(vector.stem)},'DRAFT','GOOD')`);
    for (const [i,a] of vector.answers.entries()) {
      await run(`INSERT INTO public.answers(question_id,choice_label,choice_text,explanation_text,is_correct) VALUES(${q(id)},${q('ABCD'[i])},${q(a.choice_text)},${a.explanation_text===null?'NULL':q(a.explanation_text)},${a.is_correct})`);
    }
    assert.equal(await hash(id), vector.sha256, vector.name + ' SQL/Python parity');
  }
  // Raw lifecycle writes fail even for the service role. Unchanged lifecycle
  // fields remain writable; this is not an INSERT/administrator trust boundary.
  await denied(service(`UPDATE public.questions SET status='ACTIVE' WHERE id=${q(ids[1])}`), /Use transition_question/);
  await denied(service(`UPDATE public.questions SET review_status='UNREVIEWED' WHERE id=${q(ids[1])}`), /Use transition_question/);
  await run(service(`UPDATE public.questions SET status=status,review_status=review_status WHERE id=${q(ids[1])}`));
  assert.equal(await scalar(service(`SELECT set_config('testero.lifecycle','sentinel',true);
    ${publish(ids[0],await hash(ids[0]))}; SELECT current_setting('testero.lifecycle')`)).then(s=>s.split('\n').at(-1)), 'sentinel');
  await denied(service(`UPDATE public.questions SET status='RETIRED' WHERE id=${q(ids[0])}`), /Use transition_question/);
  await run(`BEGIN; SELECT set_config('testero.lifecycle','1',true);
    UPDATE public.questions SET status='DRAFT' WHERE id=${q(ids[0])};
    DELETE FROM public.question_events WHERE question_id=${q(ids[0])}; COMMIT;`);
  // A flag is restored after an exception INSIDE the write block, not merely
  // after preflight errors. Roll back the injected trigger and successful write.
  await run(`BEGIN;
    CREATE FUNCTION pg_temp.reject_lifecycle_test() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'injected lifecycle failure'; END $$;
    CREATE TRIGGER z_reject_lifecycle_test BEFORE UPDATE ON public.questions
     FOR EACH ROW WHEN (NEW.id=${q(ids[0])}::uuid AND NEW.status='ACTIVE')
     EXECUTE FUNCTION pg_temp.reject_lifecycle_test();
    SET LOCAL ROLE service_role;
    SELECT set_config('testero.lifecycle','sentinel',true);
    DO $$ BEGIN
      BEGIN PERFORM public.publish_question(${q(ids[0])},public.question_content_sha256(${q(ids[0])}),'test');
      EXCEPTION WHEN OTHERS THEN
       IF SQLERRM <> 'injected lifecycle failure' THEN RAISE; END IF;
      END;
      IF current_setting('testero.lifecycle',true) IS DISTINCT FROM 'sentinel' THEN
       RAISE EXCEPTION 'lifecycle flag leaked after exception'; END IF;
    END $$; ROLLBACK;`);
  assert.equal(await scalar(`BEGIN; SET LOCAL ROLE service_role;
    SELECT set_config('testero.lifecycle','1',true); ${publish(ids[0],await hash(ids[0]))};
    SELECT current_setting('testero.lifecycle'); ROLLBACK;`).then(s=>s.split('\n').at(-1)), '1','existing trusted flag is preserved');
  assert.equal(await scalar(service(`${publish(ids[0],await hash(ids[0]))};
    SELECT coalesce(current_setting('testero.lifecycle',true),'')=''`)).then(s=>s.split('\n').at(-1)), 't');
  // Return test-only publications to DRAFT inside an explicit trusted fixture
  // boundary. They must not change the originals-only floor scenarios below.
  await run(`BEGIN; SELECT set_config('testero.lifecycle','1',true);
    UPDATE public.questions SET status='DRAFT' WHERE id IN (${q(ids[0])},${q(ids[1])});
    DELETE FROM public.question_events WHERE question_id IN (${q(ids[0])},${q(ids[1])}); COMMIT;`);
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
  await denied(service(finalize(quarantined)),/review finalization eligibility/);
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
  await run(service(`UPDATE public.questions SET parent_question_id=${q(ids[5])} WHERE id=${q(ids[8])}`));
  // Already-approved legacy variants can still withdraw and restore. This fixture
  // uses an administrator-only setup write, not the original-only publish RPC.
  await run(`BEGIN; SELECT set_config('testero.lifecycle','1',true); UPDATE public.questions SET status='ACTIVE',content_sha256=public.question_content_sha256(id) WHERE id=${q(ids[8])}; COMMIT;`);
  assert.equal((await result(quarantine(ids[8]))).changed,true);
  assert.equal((await result(restore(ids[8],await hash(ids[8])))).changed,true);
  // Cross-domain nested variants: quarantine/retirement withdraw every ACTIVE
  // descendant atomically, without changing already withdrawn children.
  for (const d of [familyDomain,crossDomain]) await run(`INSERT INTO public.exam_domains(id,exam,code,name)
    VALUES(${q(d)},'GCP_PM_ML_ENG',${q('FAMILY-'+d)},'Family verifier')`);
  for (const [i,fid] of family.entries()) {
    const parent = i<4 ? null : family[i===5?4:i===8?1:0];
    await run(`INSERT INTO public.questions(id,exam,domain_id,parent_question_id,stem,status,review_status)
      VALUES(${q(fid)},'GCP_PM_ML_ENG',${q([4,6,8].includes(i)?crossDomain:familyDomain)},${parent?q(parent):'NULL'},'Family verifier','DRAFT','GOOD');
      INSERT INTO public.answers(question_id,choice_label,choice_text,explanation_text,is_correct)
      SELECT ${q(fid)},x,x,'Explanation '||x,x='A' FROM unnest(ARRAY['A','B','C','D']) x;`);
    if (i<4) await run(service(publish(fid,await hash(fid))));
    else if (i!==6) await run(`BEGIN; SELECT set_config('testero.lifecycle','1',true);
      UPDATE public.questions SET status=${q(i===7?'RETIRED':'ACTIVE')},review_status=${q(i===7?'RETIRED':'GOOD')} WHERE id=${q(fid)}; COMMIT;`);
  }
  const familyResult = await result(quarantine(family[0]));
  assert.equal(familyResult.changed,true);
  assert.equal(await scalar(`SELECT count(*) FROM public.questions WHERE id IN (${family.slice(4,6).map(q).join(',')}) AND status='DRAFT' AND review_status='QUARANTINED'`),'2');
  assert.equal(await scalar(`SELECT count(*) FROM public.question_events WHERE payload->>'cascade_from_question_id'=${q(family[0])} AND action='quarantined'`),'2');
  assert.equal(await scalar(`SELECT count(*) FROM public.question_events WHERE question_id IN (${q(family[6])},${q(family[7])})`),'0');
  await denied(service(restore(family[4],await hash(family[4]))),/Restore original ancestry/);
  await run(service(restore(family[0],await hash(family[0]))));
  assert.equal(await scalar(`SELECT count(*) FROM public.questions WHERE id IN (${family.slice(4,6).map(q).join(',')}) AND status='ACTIVE'`),'0','original restore never restores variants');
  for (const fid of family.slice(4,6)) await run(service(restore(fid,await hash(fid))));
  // Opposite original/descendant lifecycle calls across domains cannot deadlock.
  const crossRace = await Promise.all([
    run(service(`SET LOCAL statement_timeout='5s'; ${retire(family[0],await hash(family[0]))}`)),
    run(service(`SET LOCAL statement_timeout='5s'; ${quarantine(family[5])}`))]);
  assert.ok(crossRace.every(r=>r.code===0));
  assert.equal(await scalar(`SELECT count(*) FROM public.questions WHERE id IN (${family.slice(0,1).concat(family.slice(4,6)).map(q).join(',')}) AND status='ACTIVE'`),'0');
  assert.equal((await result(quarantine(family[1]))).outcome,'floor_blocked');
  assert.equal(await scalar(`SELECT status FROM public.questions WHERE id=${q(family[8])}`),'ACTIVE','blocked original does not cascade');
  console.log('PASS pipeline v6 A: hashes; ACL/RLS; guarded draft review finalization; UPDATE guard and flag restoration; hash/revision/cycle fences; immutable ACTIVE content; floor races; recursive cross-domain variant cascade; no auto-restore; legacy eligibility');
} finally {
  await run(`DELETE FROM public.question_events WHERE question_id IN (${ingest.map(q).join(',')});
    DELETE FROM public.questions WHERE id IN (${ingest.map(q).join(',')});
    DELETE FROM public.question_generation_runs WHERE id=${q(runId)};`);
  await run(`DELETE FROM public.question_events WHERE question_id IN (${family.map(q).join(',')});
    BEGIN; SELECT set_config('testero.lifecycle','1',true);
    UPDATE public.questions SET status='RETIRED' WHERE id IN (${family.map(q).join(',')}); COMMIT;
    DELETE FROM public.questions WHERE id=${q(family[5])};
    DELETE FROM public.questions WHERE id IN (${family.slice(4).map(q).join(',')});
    DELETE FROM public.questions WHERE id IN (${family.map(q).join(',')});
    DELETE FROM public.exam_domains WHERE id IN (${q(familyDomain)},${q(crossDomain)});`);
  await run(`DELETE FROM public.question_events WHERE question_id IN (${ids.map(q).join(',')});
    BEGIN; SELECT set_config('testero.lifecycle','1',true);
    UPDATE public.questions SET status='RETIRED' WHERE domain_id=${q(domain)};
    COMMIT;
    DELETE FROM public.questions WHERE domain_id=${q(domain)} AND parent_question_id IS NOT NULL;
    DELETE FROM public.questions WHERE domain_id=${q(domain)};
    DELETE FROM public.exam_domains WHERE id=${q(domain)};`);
}
