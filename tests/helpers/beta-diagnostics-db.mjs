/** Real PostgreSQL beta RPC checks. Invoked only by the loopback-only DB verifier.
 * All bank, account, session and quota fixtures are rolled back in each group.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const scope = ["data-engineer", "cloud-architect", "cloud-engineer", "generative-ai-leader", "agentic-architect"];

export async function verifyBetaDiagnostics({ run, scalar, q, pmleDomain, pmleCode, digestSQL }) {
  const before = await scalar(digestSQL);
  const migration = readFileSync(new URL("../../supabase/migrations/20261021190000_multi_cert_beta_diagnostics.sql", import.meta.url), "utf8");
  await run(migration.replace(/COMMIT;\s*$/, "ROLLBACK;"));
  assert.equal(await scalar(digestSQL), before, "beta migration replay leaves every row unchanged");
  for (const cert of ["generative-ai-leader", "agentic-architect"]) {
    const data = JSON.parse(readFileSync(new URL(`../../content-pipeline/certs/${cert}.json`, import.meta.url), "utf8"));
    const guide = data.guides[0];
    const domains = JSON.parse(await scalar(`SELECT json_agg(d ORDER BY code) FROM
      (SELECT code,name,description FROM public.exam_domains WHERE exam=${q(cert)}) d;`));
    assert.deepEqual(domains, guide.sections.map(section => ({ code: section.id, name: section.title,
      description: `${guide.variant[0].toUpperCase() + guide.variant.slice(1)} guide section ${section.number}; weight ${Number(section.weight_percent).toFixed(1)}%; guide SHA256 ${guide.normalized_text_sha256}`,
    })).sort((a, b) => a.code.localeCompare(b.code)), `${cert}: domain seed matches guides[0] exactly`);
  }
  for (const [name, count] of [["create_study_session", "6"], ["v2_create_study_session", "7"]]) {
    assert.equal(await scalar(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=${q(name)};`), "1", `${name}: one unambiguous overload`);
    assert.equal(await scalar(`SELECT pronargs FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=${q(name)};`), count);
    assert.equal(await scalar(`SELECT pronargdefaults FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=${q(name)};`), "1", `${name}: trailing exam is optional`);
  }

  const snapshot = (id, code) => ({ question_id: id, domain_code: code,
    domain_name: "Isolated beta domain", stem: "Isolated beta snapshot", correct_label: "A",
    options: [{ label: "A", text: "First" }, { label: "B", text: "Second" }],
    exam: "GCP_PM_ML_ENG", parent_question_id: null }); // spoofed fields must never override the bank
  const itemsSQL = (ids, code) => q(JSON.stringify(ids.map(id => snapshot(id, code)))) + "::jsonb";
  const hash = q("b".repeat(64));
  const legacy = (ids, code, exam, kind = "diagnostic", user = "NULL") =>
    `public.create_study_session(${q(kind)},${user},${user === "NULL" ? hash : "NULL"},${itemsSQL(ids, code)},now()+interval '1 hour'${exam === undefined ? "" : "," + q(exam)})`;
  const central = (ids, code, exam, kind = "diagnostic", user = "NULL", free = false) =>
    `public.v2_create_study_session(${q(kind)},${user},${user === "NULL" ? hash : "NULL"},${itemsSQL(ids, code)},now()+interval '1 hour',${free}${exam === undefined ? "" : "," + q(exam)})`;
  const rejects = (call, message) => `DO $reject$ BEGIN
    BEGIN
      PERFORM ${call};
      RAISE EXCEPTION 'RPC unexpectedly accepted rejected fixture';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM <> ${q(message)} THEN RAISE; END IF;
    END;
  END $reject$;`;
  const crossExam = "Study items must belong to the session exam";
  const unsupported = "Unsupported beta diagnostic exam, kind or length";
  const threshold = "Beta diagnostic requires 20 approved live originals";
  const originalsOnly = "Beta diagnostic items must be approved live single-select originals";

  for (const cert of scope) {
    const domain = await scalar(`SELECT id FROM public.exam_domains WHERE exam=${q(cert)} ORDER BY code LIMIT 1;`);
    const code = await scalar(`SELECT code FROM public.exam_domains WHERE id=${q(domain)};`);
    const owner = randomUUID(), paid = randomUUID();
    const ids = Array.from({ length: 20 }, () => randomUUID());
    const pmleIds = Array.from({ length: 20 }, () => randomUUID());
    const variant = randomUUID(), draft = randomUUID(), unreviewed = randomUUID(), multiple = randomUUID();
    const missing = randomUUID();
    const insertQuestion = (id, exam, domainId, status = "ACTIVE", review = "GOOD", parent = null, type = "single_select") =>
      `(${q(id)},${q(exam)},${q(domainId)},'Isolated beta DB fixture',${q(status)},${q(review)},${parent ? q(parent) : "NULL"},${q(type)})`;
    const fixture = `
      INSERT INTO auth.users(id) VALUES (${q(owner)}),(${q(paid)});
      INSERT INTO public.user_subscriptions(user_id,stripe_customer_id,status)
        VALUES (${q(paid)},${q("local-beta-" + randomUUID())},'active');
      -- Isolate the threshold from any existing approved bank; this update rolls back.
      UPDATE public.questions SET status='DRAFT' WHERE exam=${q(cert)};
      INSERT INTO public.questions(id,exam,domain_id,stem,status,review_status,parent_question_id,question_type) VALUES
        ${ids.map(id => insertQuestion(id, cert, domain)).join(",")},
        ${pmleIds.map(id => insertQuestion(id, "GCP_PM_ML_ENG", pmleDomain, "DRAFT", "UNREVIEWED")).join(",")},
        ${insertQuestion(variant, cert, domain, "ACTIVE", "GOOD", ids[0])},
        ${insertQuestion(draft, cert, domain, "DRAFT")},
        ${insertQuestion(unreviewed, cert, domain, "ACTIVE", "UNREVIEWED")},
        ${insertQuestion(multiple, cert, domain, "DRAFT", "GOOD", null, "multiple_select")};
    `;
    const checks = [];
    for (const count of [5, 10]) {
      for (const user of ["NULL", q(owner)]) {
        checks.push(`DO $accepted$ DECLARE session UUID; BEGIN
          session := ${legacy(ids.slice(0, count), code, cert, "diagnostic", user)};
          IF NOT EXISTS (SELECT 1 FROM public.study_sessions WHERE id=session AND exam=${q(cert)} AND question_count=${count})
            OR (SELECT count(*) FROM public.session_items WHERE session_id=session) <> ${count} THEN
            RAISE EXCEPTION 'beta session failed to persist exam or item count';
          END IF;
        END $accepted$;`);
      }
    }
    checks.push(`SELECT ${central(ids.slice(0, 5), code, cert, "diagnostic", "NULL", true)};`);
    for (const count of [1, 4, 6, 20]) {
      checks.push(rejects(legacy(ids.slice(0, count), code, cert), unsupported));
      checks.push(rejects(central(ids.slice(0, count), code, cert), unsupported));
    }
    const mixed = [pmleIds[0], ...ids.slice(1, 5)];
    checks.push(rejects(legacy(mixed, code, cert), crossExam));
    checks.push(rejects(central(mixed, code, cert), crossExam));
    checks.push(rejects(legacy([missing, ...ids.slice(1, 5)], code, cert), crossExam));
    // Omitted p_exam is PMLE, not a backdoor into another question bank.
    checks.push(rejects(legacy(ids.slice(0, 5), code, undefined), crossExam));
    checks.push(rejects(central(ids.slice(0, 5), code, undefined), crossExam));
    for (const invalid of [variant, draft, unreviewed, multiple]) {
      checks.push(rejects(legacy([invalid, ...ids.slice(1, 5)], code, cert), originalsOnly));
      checks.push(rejects(central([invalid, ...ids.slice(1, 5)], code, cert), originalsOnly));
    }
    // ACTIVE variants, unreviewed originals and DRAFT GOOD originals do not reach 20.
    checks.push(`RESET ROLE; UPDATE public.questions SET status='DRAFT' WHERE id=${q(ids[19])}; SET LOCAL ROLE service_role;`);
    checks.push(rejects(legacy(ids.slice(0, 5), code, cert), threshold));
    checks.push(rejects(central(ids.slice(0, 5), code, cert), threshold));
    checks.push(`RESET ROLE; UPDATE public.questions SET status='ACTIVE' WHERE id=${q(ids[19])}; SET LOCAL ROLE service_role;`);
    for (const user of [q(owner), q(paid)]) {
      for (const free of [false, true]) checks.push(rejects(central(ids.slice(0, 5), code, cert, "practice", user, free), unsupported));
      checks.push(rejects(legacy(ids.slice(0, 5), code, cert, "practice", user), unsupported));
      checks.push(rejects(legacy(ids.slice(0, 5), code, undefined, "practice", user), crossExam));
      checks.push(rejects(`public.create_free_practice_session(${user},${itemsSQL(ids.slice(0, 5), code)},now()+interval '1 hour')`, crossExam));
    }
    checks.push(`DO $uncharged$ BEGIN
      IF EXISTS (SELECT 1 FROM public.free_practice_quota WHERE user_id IN (${q(owner)},${q(paid)}))
        OR EXISTS (SELECT 1 FROM public.study_sessions WHERE user_id IN (${q(owner)},${q(paid)}) AND kind='practice') THEN
        RAISE EXCEPTION 'beta diagnostic or rejected practice charged quota/created practice';
      END IF;
    END $uncharged$;`);
    // PMLE keeps legacy lengths, no beta bank threshold, and original free/paid practice paths.
    for (const count of [1, 5, 10, 20]) checks.push(`SELECT ${legacy(pmleIds.slice(0, count), pmleCode, undefined)};`);
    checks.push(`SELECT public.create_free_practice_session(${q(owner)},${itemsSQL(pmleIds.slice(0, 1), pmleCode)},now()+interval '1 hour');`);
    checks.push(`SELECT ${legacy(pmleIds.slice(0, 1), pmleCode, undefined, "practice", q(paid))};`);
    checks.push(`DO $pmle$ BEGIN
      IF (SELECT questions_used FROM public.free_practice_quota WHERE user_id=${q(owner)}) IS DISTINCT FROM 1
        OR EXISTS (SELECT 1 FROM public.free_practice_quota WHERE user_id=${q(paid)})
        OR EXISTS (SELECT 1 FROM public.study_sessions WHERE kind='practice' AND user_id IN (${q(owner)},${q(paid)}) AND exam <> 'GCP_PM_ML_ENG') THEN
        RAISE EXCEPTION 'PMLE exam persistence or quota behavior changed';
      END IF;
    END $pmle$;`);
    await run(`BEGIN; ${fixture} SET LOCAL ROLE service_role; ${checks.join("\n")} ROLLBACK;`);
  }
  // An otherwise eligible bank outside the approved five must not become a beta.
  const outside = "security-engineer", domain = randomUUID(), ids = Array.from({ length: 20 }, () => randomUUID());
  await run(`BEGIN;
    INSERT INTO public.exam_domains(id,exam,code,name) VALUES (${q(domain)},${q(outside)},'isolated-beta-scope','Isolated scope fixture');
    INSERT INTO public.questions(id,exam,domain_id,stem,status,review_status) VALUES
      ${ids.map(id => `(${q(id)},${q(outside)},${q(domain)},'Out of scope fixture','ACTIVE','GOOD')`).join(",")};
    SET LOCAL ROLE service_role;
    ${rejects(legacy(ids.slice(0, 5), "isolated-beta-scope", outside), unsupported)}
    ${rejects(central(ids.slice(0, 5), "isolated-beta-scope", outside), unsupported)}
    ROLLBACK;`);
  assert.equal(await scalar(digestSQL), before, "all beta fixtures and every rejected/successful RPC roll back");
  console.log("PASS beta guide seeds/replay, optional unambiguous RPCs, five-cert 5/10 sessions, persisted exam, cross-exam/scope/threshold/original guards, PMLE-only free/paid practice and rollback");
}
