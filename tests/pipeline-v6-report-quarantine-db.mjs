/** Pipeline v6 B. Local-only ownership, mock compatibility, dedupe and daily cap races. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { run, q, scalar, service, denied } from "./helpers/pipeline-v6-db.mjs";

const domains = Array.from({length:3},()=>randomUUID());
const ids = Array.from({length:15},()=>randomUUID());
const sessions = [], items = [], hashes = [];
const mockOwner = randomUUID(), mockSession = randomUUID(), mockItem = randomUUID();
const call = (index, reason='wrong answer', override={}) => {
  const a = {session:sessions[index],item:items[index],kind:'diagnostic',user:null,owner:hashes[index],reason,...override};
  return `SELECT public.submit_question_report(${q(a.session)},${q(a.item)},${q(a.kind)},${a.user?q(a.user):'NULL'},${a.owner?q(a.owner):'NULL'},${q(a.reason)},'Verifier','')`;
};
const outcome = index => scalar(`SELECT payload->>'outcome' FROM public.question_events WHERE question_id=${q(ids[index])} AND action='report' ORDER BY at DESC LIMIT 1`);
const quarantines = async () => Number(await scalar(`SELECT count(*) FROM public.question_events WHERE actor='question-report' AND action='quarantined' AND at >= date_trunc('day',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`));
try {
  assert.equal(await quarantines(),0,'Use a clean local report-quarantine day (never delete other fixtures)');
  for (const role of ['anon','authenticated']) {
    assert.equal(await scalar(`SELECT has_function_privilege(${q(role)},'public.submit_question_report(uuid,uuid,text,uuid,text,text,text,text)','EXECUTE')`),'f');
  }
  for (const domain of domains) await run(`INSERT INTO public.exam_domains(id,exam,code,name) VALUES(${q(domain)},'GCP_PM_ML_ENG',${q('REPORT-'+domain)},'Isolated report verifier')`);
  for (const [i,id] of ids.entries()) {
    const domain = domains[i<6?0:i<12?1:2];
    await run(`INSERT INTO public.questions(id,exam,domain_id,stem,status,review_status) VALUES(${q(id)},'GCP_PM_ML_ENG',${q(domain)},'Report verifier','DRAFT','GOOD');
      INSERT INTO public.answers(question_id,choice_label,choice_text,explanation_text,is_correct)
      SELECT ${q(id)},x,x,'Explanation '||x,x='A' FROM unnest(ARRAY['A','B','C','D']) x;
      SELECT public.publish_question(${q(id)},public.question_content_sha256(${q(id)}),'report-verifier');`);
    sessions.push(randomUUID()); items.push(randomUUID()); hashes.push(randomUUID().replaceAll('-','').repeat(2));
    await run(`INSERT INTO public.study_sessions(id,kind,anonymous_owner_hash,question_count,domain_codes,expires_at)
      VALUES(${q(sessions[i])},'diagnostic',${q(hashes[i])},1,ARRAY['REPORT'],now()+interval '1 hour');
      INSERT INTO public.session_items(id,session_id,ordinal,question_id,domain_code,domain_name,stem,options,correct_label)
      VALUES(${q(items[i])},${q(sessions[i])},1,${q(id)},'REPORT','Report verifier','Report verifier','[{"label":"A","text":"A"},{"label":"B","text":"B"}]','A');`);
  }
  await denied(service(call(0,'wrong answer',{owner:'0'.repeat(64)})),/Question not found/);
  await denied(service(call(0,'wrong answer',{item:items[1]})),/Question not found/);
  await denied(service(call(0,'wrong answer',{kind:'practice'})),/Question not found/);
  await run(service(call(12)));
  assert.equal(await outcome(12),'floor_blocked');
  assert.equal(await quarantines(),0);
  // Mock reporting uses the same RPC signature, requires completed owned mock.
  await run(`INSERT INTO auth.users(id) VALUES(${q(mockOwner)});
    INSERT INTO public.mock_exam_sessions(id,user_id,question_count,deadline_at)
    VALUES(${q(mockSession)},${q(mockOwner)},50,now()+interval '2 hours');
    INSERT INTO public.mock_exam_items(id,session_id,ordinal,question_id,domain_code,domain_name,stem,options,correct_label)
    VALUES(${q(mockItem)},${q(mockSession)},1,${q(ids[1])},'REPORT','Report verifier','Report verifier','[{"label":"A","text":"A"},{"label":"B","text":"B"}]','A');`);
  const mockCall = override => call(1,'outdated',{session:mockSession,item:mockItem,kind:'mock',user:mockOwner,owner:hashes[1],...override});
  await denied(service(mockCall({})),/Question not found/);
  await run(`UPDATE public.mock_exam_sessions SET completed_at=now() WHERE id=${q(mockSession)}`);
  await denied(service(mockCall({user:randomUUID()})),/Question not found/);
  await denied(service(mockCall({item:items[1]})),/Question not found/);
  await run(service(mockCall({})));
  assert.equal(await scalar(`SELECT count(*) FROM public.question_reports WHERE mock_session_id=${q(mockSession)} AND mock_item_id=${q(mockItem)} AND session_id IS NULL AND item_id IS NULL`),'1');
  assert.equal(await quarantines(),1);
  // Per-question dedupe across owners: the mock report already quarantined q1.
  const duplicates = await Promise.all(Array.from({length:4},()=>run(service(call(1)))));
  assert.equal(duplicates.filter(r=>r.code===0).length,4);
  assert.equal(await quarantines(),1);
  assert.equal(await outcome(1),'already_quarantined');
  // A report after successful re-council opens a NEW episode and pages founder.
  await run(service(`SELECT public.restore_question(${q(ids[1])},public.question_content_sha256(${q(ids[1])}),'report-verifier')`));
  await run(service(call(1)));
  assert.equal(await quarantines(),2);
  assert.equal(await scalar(`SELECT payload->>'founder_page' FROM public.question_events WHERE question_id=${q(ids[1])} AND action='report' ORDER BY at DESC LIMIT 1`),'true');
  // Independently owned reports race across domains; at most five total commit.
  await Promise.all([0,3,6,7,8,9].map(i=>run(service(call(i)))));
  assert.equal(await quarantines(),5);
  assert.ok(Number(await scalar(`SELECT count(*) FROM public.question_events WHERE question_id IN (${ids.map(q).join(',')}) AND action='report' AND payload->>'outcome'='daily_cap'`))>=1);
  for (const domain of domains) assert.ok(Number(await scalar(`SELECT count(*) FROM public.questions WHERE domain_id=${q(domain)} AND status='ACTIVE' AND parent_question_id IS NULL`))>=3);
  // Hourly report-row limit remains durable even for non-quarantining reasons.
  const quota = await Promise.all(Array.from({length:15},()=>run(service(call(14,'typo')),true)));
  assert.equal(quota.filter(r=>r.code===0).length,10);
  for (const failure of quota.filter(r=>r.code!==0)) assert.match(failure.error,/Report limit exceeded/);
  assert.equal(await scalar(`SELECT count(*) FROM public.question_reports WHERE owner_key=${q('anon:'+hashes[14])}`),'10');
  console.log('PASS pipeline v6 B: service-only RPC; ownership/membership; completed mock reports; immediate floor-respecting quarantine; cross-owner dedupe; repeat report page; concurrent global UTC daily cap 5; durable owner 10/hour cap');
} finally {
  await run(`DELETE FROM public.question_reports WHERE question_id IN (${ids.map(q).join(',')});
    DELETE FROM public.question_events WHERE question_id IN (${ids.map(q).join(',')});
    DELETE FROM public.study_sessions WHERE id IN (${sessions.length?sessions.map(q).join(','):'NULL'});
    DELETE FROM public.mock_exam_sessions WHERE id=${q(mockSession)};
    DELETE FROM auth.users WHERE id=${q(mockOwner)};
    UPDATE public.questions SET status='RETIRED' WHERE domain_id IN (${domains.map(q).join(',')});
    DELETE FROM public.questions WHERE domain_id IN (${domains.map(q).join(',')});
    DELETE FROM public.exam_domains WHERE id IN (${domains.map(q).join(',')});`);
}
