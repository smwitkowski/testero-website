import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DiagnosticProgress } from "../lib/diagnostic/types";
import type { MockProgress, MockResults } from "../lib/mock/types";


// Local fixture-only bypass, transaction-scoped. Production lifecycle stays RPC-only.
async function fixtureStatus(ids: string[], status: "ACTIVE" | "DRAFT" | "RETIRED", review: "GOOD" | "QUARANTINED" | "RETIRED") {
  const url = new URL(process.env.DATABASE_URL!);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.port !== "56542" || url.pathname !== "/postgres" || url.search
    || ids.some(id => !/^[0-9a-f-]{36}$/.test(id))) throw new Error("Local fixture database required");
  const env: NodeJS.ProcessEnv = { ...process.env, PGHOST: url.hostname.replace(/[\[\]]/g, ""), PGPORT: url.port, PGDATABASE: "postgres", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: "disable" };
  for (const key of ["PGSERVICE", "PGSERVICEFILE", "PGHOSTADDR", "PGOPTIONS", "PGPASSFILE"]) delete env[key];
  await promisify(execFile)("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-c", `BEGIN; SELECT set_config('testero.lifecycle','1',true); UPDATE public.questions SET status='${status}',review_status='${review}' WHERE id IN (${ids.map(id => `'${id}'::uuid`).join(",")}); COMMIT;`], { env });
}

test("quarantined saved questions disappear from diagnostic, practice, mock answers and review", async ({ page }) => {
  test.setTimeout(120_000);
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname); expect(url.port).toBe("56541");
  const db = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `withdrawal-${randomUUID()}@example.test`, password = `Local-${randomUUID()}-Aa9`;
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  expect(created.error).toBeNull(); const userId = created.data.user!.id;
  const domainId = randomUUID(), withdrawn = randomUUID(), live = randomUUID();
  const diagnostic = randomUUID(), practice = randomUUID(), mock = randomUUID();
  const diagnosticItem = randomUUID(), practiceItem = randomUUID(), mockItem = randomUUID();
  const secret = `Withdraw this saved stem ${randomUUID()}`;
  const domain = `WITHDRAWAL_${randomUUID()}`;
  const options = [{ label: "A", text: "First" }, { label: "B", text: "Second" }];
  const failures: string[] = []; page.on("pageerror", error => failures.push(error.message));
  try {
    expect((await db.from("exam_domains").insert({ id: domainId, exam: "GCP_PM_ML_ENG", code: domain, name: "Withdrawal fixture" })).error).toBeNull();
    expect((await db.from("questions").insert([withdrawn, live].map(id => ({ id, domain_id: domainId, exam: "GCP_PM_ML_ENG", stem: id === withdrawn ? secret : "Keep this active question", status: "DRAFT", review_status: "GOOD" })))).error).toBeNull();
    expect((await db.from("answers").insert([withdrawn, live].flatMap(question_id => options.map(option => ({ question_id, choice_label: option.label, choice_text: option.text, is_correct: option.label === "A", explanation_text: `Explanation ${option.label}` }))))).error).toBeNull();
    await fixtureStatus([withdrawn,live], "ACTIVE", "GOOD");
    expect((await db.rpc("fulfill_pmle_pass", { p_user_id: userId, p_stripe_checkout_session_id: `cs_test_withdrawal_${userId}`, p_stripe_payment_intent_id: `pi_local_withdrawal_${userId}`, p_stripe_customer_id: "cus_local_withdrawal", p_paid_at: new Date().toISOString() })).error).toBeNull();
    for (const [id, kind, itemId] of [[diagnostic,"diagnostic",diagnosticItem],[practice,"practice",practiceItem]]) {
      expect((await db.from("study_sessions").insert({ id, kind, user_id: userId, question_count: 2, domain_codes: [domain], expires_at: new Date(Date.now()+3_600_000).toISOString() })).error).toBeNull();
      expect((await db.from("session_items").insert([withdrawn,live].map((question_id,index) => ({ id: index ? randomUUID() : itemId, session_id: id, question_id, ordinal: index+1, domain_code: domain, domain_name: "Withdrawal fixture", stem: index ? "Keep this active question" : secret, options, correct_label: "A" })))).error).toBeNull();
    }
    expect((await db.from("mock_exam_sessions").insert({ id: mock, user_id: userId, question_count: 50, deadline_at: new Date(Date.now()+7_200_000).toISOString() })).error).toBeNull();
    expect((await db.from("mock_exam_items").insert(Array.from({ length: 50 }, (_,i) => ({ id: i ? randomUUID() : mockItem, session_id: mock, question_id: i ? live : withdrawn, ordinal: i+1, domain_code: domain, domain_name: "Withdrawal fixture", stem: i ? "Keep this active question" : secret, options, correct_label: "A", selected_label: i ? "A" : null, answered_at: i ? new Date().toISOString() : null })))).error).toBeNull();
    await page.goto("/login?next=/dashboard");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    // Withdraw only our fixture, after sessions have already stored the question.
    await fixtureStatus([withdrawn], "DRAFT", "QUARANTINED");
    for (const [kind,id,item] of [["diagnostic",diagnostic,diagnosticItem],["practice",practice,practiceItem]]) {
      const path = `/api/${kind}/${id}`;
      const state = await (await page.request.get(path)).json() as DiagnosticProgress;
      expect(state).toMatchObject({ totalQuestions: 1, withdrawnCount: 1, answeredCount: 0 }); expect(JSON.stringify(state)).not.toContain(secret);
      const stale = await page.request.post(`${path}/answer`, { data: { itemId: item, selectedLabel: "A" } });
      expect(stale.status()).toBe(200); expect((await stale.json()).feedback).toBeNull();
      await page.goto(`/${kind}/${id}`);
      await expect(page.getByText(/withdrawn question\(s\) were skipped/)).toBeVisible(); await expect(page.getByText(secret)).toHaveCount(0);
      const answer = await page.request.post(`${path}/answer`, { data: { itemId: state.currentQuestion!.id, selectedLabel: "A" } });
      expect(answer.status()).toBe(200); expect((await answer.json()).completed).toBe(true);
      const results = await (await page.request.get(`${path}/${kind === "diagnostic" ? "results" : "summary"}`)).json();
      expect(results).toMatchObject({ score: 100, totalQuestions: 1, withdrawnCount: 1 }); expect(JSON.stringify(results)).not.toContain(secret);
    }
    const mockPath = `/api/mock/${mock}`;
    const stale = await page.request.post(`${mockPath}/answer`, { data: { itemId: mockItem, selectedLabel: "B" } }); expect(stale.status()).toBe(200);
    const progress = await stale.json() as MockProgress; expect(progress).toMatchObject({ totalQuestions: 49, withdrawnCount: 1, answeredCount: 49 }); expect(JSON.stringify(progress)).not.toContain(secret);
    await page.goto(`/mock/${mock}`); await expect(page.getByText(/withdrawn question\(s\) were skipped/)).toBeVisible(); await expect(page.getByText(secret)).toHaveCount(0);
    expect((await page.request.post(`${mockPath}/submit`)).status()).toBe(200);
    const result = await (await page.request.get(`${mockPath}/results`)).json() as MockResults;
    expect(result).toMatchObject({ score: 100, totalQuestions: 49, correctAnswers: 49, withdrawnCount: 1 }); expect(result.review).toHaveLength(49); expect(JSON.stringify(result)).not.toContain(secret);
    // Restore after all three sessions completed. Excluded snapshots stay excluded.
    await fixtureStatus([withdrawn], "ACTIVE", "GOOD");
    for (const [kind, id] of [["diagnostic", diagnostic], ["practice", practice]]) {
      const restored = await page.request.get(`/api/${kind}/${id}/${kind === "diagnostic" ? "results" : "summary"}`);
      expect(restored.status()).toBe(200);
      const body = await restored.json(); expect(body).toMatchObject({ score: 100, totalQuestions: 1, withdrawnCount: 1 });
      expect(JSON.stringify(body)).not.toContain(secret);
    }
    const restoredMock = await page.request.get(`${mockPath}/results`); expect(restoredMock.status()).toBe(200);
    expect(await restoredMock.json()).toMatchObject({ score: 100, totalQuestions: 49, withdrawnCount: 1 });
    await page.goto("/mock"); await expect(page.getByText("100% · 50 questions", { exact: true })).toBeVisible();
    await page.goto("/dashboard"); await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByText(secret)).toHaveCount(0);
    // This is the same result reader used by the email route/link. Do not send email.
    await page.goto(`/diagnostic/${diagnostic}/results`); await expect(page.getByText(secret)).toHaveCount(0);
    await page.goto(`/practice/${practice}/summary`); await expect(page.getByText(secret)).toHaveCount(0);
    await page.goto(`/mock/${mock}/results`); await expect(page.getByText(/not marked incorrect/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Report a problem with this question", exact: true })).toHaveCount(49);
    await page.getByRole("button", { name: "Report a problem with this question", exact: true }).first().click();
    await page.getByRole("combobox", { name: "Reason", exact: true }).first().selectOption("typo");
    await expect(page.getByRole("button", { name: "Send report", exact: true })).toBeVisible();
    // Do not submit here: immutable report audit rows belong to the SQL B rollback verifier.
    expect(failures).toEqual([]);
  } finally {
    await db.from("study_sessions").delete().in("id",[diagnostic,practice]);
    await db.from("mock_exam_sessions").delete().eq("id",mock);
    await fixtureStatus([withdrawn,live], "RETIRED", "RETIRED");
    await db.from("answers").delete().in("question_id",[withdrawn,live]);
    await db.from("questions").delete().in("id",[withdrawn,live]);
    await db.from("exam_domains").delete().eq("id",domainId);
    await db.auth.admin.deleteUser(userId);
  }
});
