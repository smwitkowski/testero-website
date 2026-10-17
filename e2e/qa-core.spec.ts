import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import type { DiagnosticProgress } from "../lib/diagnostic/types";
import type { PracticeAnswerResponse } from "../lib/practice/types";
// Reuse the established full confirmation/claim/quota and signed fake-Stripe flows.
if (process.env.TESTERO_QA === "1") {
  await import("./accounts-practice.spec");
  await import("./billing.spec");
}

test("QA diagnostic click-to-question budget and paid explanation/next/summary", async ({ page }, info) => {
  test.setTimeout(120_000);
  test.skip(process.env.TESTERO_QA !== "1", "Use npm run qa:local with the local mirror");
  const timings: Record<string, number | number[]> = { diagnosticAnswers: [], practiceAnswers: [] };
  // Warm compilation only; measured diagnostic session remains real and uncached.
  await page.goto("/diagnostic");
  const warm = await page.request.post("/api/diagnostic", { data: {} });
  expect(warm.status()).toBe(201);
  const warmId = (await warm.json()).sessionId;
  await page.goto(`/diagnostic/${warmId}`);
  await expect(page.getByText("Question 1 of 20", { exact: true })).toBeVisible();
  await page.context().clearCookies();
  await page.goto("/diagnostic");
  const started = performance.now();
  await page.getByRole("button", { name: "Begin diagnostic" }).click();
  await expect(page.getByText("Question 1 of 20", { exact: true })).toBeVisible();
  timings.diagnosticStart = performance.now() - started;
  expect(timings.diagnosticStart).toBeLessThanOrEqual(2000);
  const sessionId = new URL(page.url()).pathname.split("/").at(-1);
  for (let ordinal = 1; ordinal <= 20; ordinal++) {
    const progress = await (await page.request.get(`/api/diagnostic/${sessionId}`)).json() as DiagnosticProgress;
    expect(progress.totalQuestions).toBe(20);
    const before = performance.now();
    const answer = await page.request.post(`/api/diagnostic/${sessionId}/answer`, { data: { itemId: progress.currentQuestion!.id, selectedLabel: progress.currentQuestion!.options[0].label } });
    expect(answer.status()).toBe(200);
    (timings.diagnosticAnswers as number[]).push(performance.now() - before);
  }
  const result = await (await page.request.get(`/api/diagnostic/${sessionId}/results`)).json();
  expect(result.review).toBeUndefined();
  await page.goto(`/diagnostic/${sessionId}/results`);
  await expect(page.getByRole("heading", { name: "PMLE readiness report", exact: true })).toBeVisible();
  await expect(page.getByText("20 questions", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Score by domain", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Question review", exact: true })).toHaveCount(0);
  const accounts = JSON.parse(await readFile(".qa/accounts.json", "utf8"));
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const kind of ["free", "refunded", "unconfirmed"]) {
    const user = await service.auth.admin.getUserById(accounts[kind].id);
    expect(user.error).toBeNull();
    expect(!!user.data.user!.email_confirmed_at).toBe(kind !== "unconfirmed");
    const passes = await service.from("pmle_passes").select("refunded_at,expires_at").eq("user_id", accounts[kind].id);
    expect(passes.error).toBeNull();
    expect(passes.data!.filter(pass => !pass.refunded_at && Date.parse(pass.expires_at) > Date.now())).toHaveLength(0);
    if (kind === "refunded") expect(passes.data!.some(pass => pass.refunded_at)).toBe(true);
  }
  await page.goto("/login?next=/dashboard");
  await page.getByLabel("Email", { exact: true }).fill(accounts.paid.email);
  await page.getByLabel("Password", { exact: true }).fill(accounts.paid.password);
  const signedIn = page.waitForResponse(response => response.url().endsWith("/api/auth/login") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await signedIn).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
  const created = await page.request.post("/api/practice", { data: { domainCode: "MONITORING_ML_SOLUTIONS" } });
  expect(created.status()).toBe(201);
  const { sessionId: practice } = await created.json();
  await page.goto(`/practice/${practice}`);
  for (let ordinal = 1; ordinal <= 5; ordinal++) {
    await expect(page.getByText(`Question ${ordinal} of 5`, { exact: true })).toBeVisible();
    await page.getByRole("radio").first().check();
    const response = page.waitForResponse(r => r.url().endsWith(`/api/practice/${practice}/answer`));
    const before = performance.now();
    await page.getByRole("button", { name: "Submit answer", exact: true }).click();
    const accepted = await (await response).json() as PracticeAnswerResponse;
    (timings.practiceAnswers as number[]).push(performance.now() - before);
    expect(accepted.feedback.optionExplanations?.length).toBeGreaterThan(1);
    await expect(page.getByRole("heading", { name: "Option explanations", exact: true })).toHaveCount(1);
    for (const option of accepted.feedback.optionExplanations!) await expect(page.getByText(option.explanation, { exact: true })).toHaveCount(1);
    if (ordinal < 5) await page.getByRole("button", { name: "Next question", exact: true }).click();
    else await page.getByRole("link", { name: "View summary", exact: true }).click();
  }
  await expect(page).toHaveURL(new RegExp(`/practice/${practice}/summary$`));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await writeFile(`.qa/timings-${info.project.name}.json`, JSON.stringify({ mode: "warm compilation, real local API", viewport: info.project.name, ...timings }, null, 2));
  await info.attach("local-timings", { body: JSON.stringify(timings), contentType: "application/json" });
});

test("instant start measurement", async ({ page }, info) => {
  test.skip(process.env.TESTERO_QA !== "1");
  await page.addInitScript(() => {
    const events: Record<string, unknown>[] = []; (window as unknown as { instantEvents: unknown[] }).instantEvents = events;
    const original = window.fetch; window.fetch = async (...args) => { const start = performance.now(); const response = await original(...args); if (String(args[0]) === "/api/diagnostic") { events.push({kind:"create",start,end:performance.now(),timing:response.headers.get("server-timing")}); const json=response.json.bind(response); response.json=async()=>{const body=await json();events.push({kind:"json",at:performance.now()});return body;}; } return response; };
    document.addEventListener("click", event => { if ((event.target as Element).closest("button")?.textContent === "Begin diagnostic") events.push({kind:"click",at:performance.now()}); },true);
    document.addEventListener("focusin",()=>{ if (events.some(x=>x.kind==="click") && !events.some(x=>x.kind==="dom") && document.activeElement?.tagName === "H1" && document.querySelectorAll('input[type="radio"]').length===4) events.push({kind:"dom",at:performance.now()}); });
    new MutationObserver(() => { if (events.some(x=>x.kind==="click") && !events.some(x=>x.kind==="dom") && document.querySelectorAll('input[type="radio"]').length === 4 && document.activeElement?.tagName === "H1") events.push({kind:"dom",at:performance.now()}); }).observe(document,{subtree:true,childList:true,attributes:true});
  });
  const runs=[];
  for(let i=0;i<6;i++) {
    await page.context().clearCookies(); await page.goto("/diagnostic");
    await page.getByRole("button",{name:"Begin diagnostic",exact:true}).click(); await expect(page.getByText("Question 1 of 20",{exact:true})).toBeVisible();
    await expect(page.getByRole("heading",{level:1})).toBeFocused();
    const events = await page.evaluate(()=>(window as unknown as {instantEvents:{kind:string;at?:number}[]}).instantEvents);
    const click = events.find(x=>x.kind==="click")!.at!;
    const focused = events.find(x=>x.kind==="dom")!.at!;
    const consumed = events.find(x=>x.kind==="json")!.at!;
    const create = events.find(x=>x.kind==="create") as unknown as {start:number;end:number};
    expect(click).toBeLessThanOrEqual(create.start); expect(create.start).toBeLessThanOrEqual(create.end);
    expect(create.end).toBeLessThanOrEqual(consumed); expect(consumed).toBeLessThanOrEqual(focused);
    if(i>0) expect(focused - click).toBeLessThanOrEqual(300);
    runs.push(events);
  }
  await writeFile(`.qa/instant-${process.env.INSTANT_PHASE}-${info.project.name}.json`,JSON.stringify(runs,null,2));
});

test("instant start restores URL, refresh and back/forward without creating another session", async ({ page }) => {
  test.skip(process.env.TESTERO_QA !== "1");
  const beginRequests: string[] = []; let recordingBegin = false;
  let creates = 0; page.on("request", request => { if (recordingBegin) beginRequests.push(`${request.method()} ${new URL(request.url()).pathname}${new URL(request.url()).search}`); if (new URL(request.url()).pathname === "/api/diagnostic" && request.method() === "POST") creates++; });
  await page.goto("/"); await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Diagnostic", exact: true }).click();
  recordingBegin = true;
  await page.getByRole("button", { name: "Begin diagnostic", exact: true }).click();
  await expect(page.getByText("Question 1 of 20", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading",{level:1})).toBeFocused();
  recordingBegin = false;
  expect(beginRequests.filter(path => path.startsWith("GET ") && (path.includes("/api/diagnostic/") || path.includes("_rsc=")))).toEqual([]);
  const sessionURL = page.url(); expect(sessionURL).toMatch(/\/diagnostic\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", {name:"What the PMLE diagnostic covers"})).toHaveCount(0);
  await expect(page.getByRole("navigation",{name:"Main navigation"})).toHaveCount(0);
  await expect(page.getByRole("heading",{level:1})).toBeFocused();
  await page.getByRole("radio").first().check(); await page.getByRole("button",{name:"Next question",exact:true}).click();
  await expect(page.getByText("Question 2 of 20",{exact:true})).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(/\/$/);
  await page.goForward(); await expect(page).toHaveURL(sessionURL);
  await expect(page.getByText("Question 2 of 20",{exact:true})).toBeVisible();
  await page.getByRole("link", { name: "Testero home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack(); await expect(page.getByText("Question 2 of 20",{exact:true})).toBeVisible();
  await page.reload(); await expect(page.getByText("Question 2 of 20",{exact:true})).toBeVisible();
  expect(creates).toBe(1);
  await page.getByRole("link", {name:"Testero home"}).click(); await expect(page).toHaveURL(/\/$/);
  await page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Diagnostic",exact:true}).click();
  await expect(page.getByRole("heading",{name:"PMLE readiness diagnostic",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Start over",exact:true}).click();
  await expect(page.getByText("Question 1 of 20",{exact:true})).toBeVisible();
  expect(page.url()).not.toBe(sessionURL); expect(creates).toBe(2);
});
