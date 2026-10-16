import { test, expect, request, type APIResponse, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

function privateResponse(response: APIResponse) {
  const cache = response.headers()["cache-control"] ?? "";
  expect(cache, response.url()).toContain("private");
  expect(cache, response.url()).toContain("no-store");
  expect(cache).not.toContain("s-maxage");
}

test("confirmed account and diagnostic responses stay private while public HTML remains cookie-free", async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_MANAGED_SERVER !== "1", "Cache-Control assertions require a built production server, not next dev overrides.");
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(url.hostname).toBe("127.0.0.1");
  expect(url.port).toBe("56541");
  const service = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `cache-${randomUUID()}@example.test`;
  const password = `Testero-${randomUUID()}-Aa9`;
  const createdUser = await service.auth.admin.createUser({ email, password, email_confirm: false });
  expect(createdUser.error).toBeNull();
  const userId = createdUser.data.user!.id;
  let sessionId: string | undefined;
  let authenticatedRequest: APIRequestContext | undefined;
  try {
    // Exercise the canonical checked-in template contract, independently of the running mail template.
    const confirmation = await service.auth.admin.generateLink({ type: "signup", email, password });
    expect(confirmation.error).toBeNull();
    await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(confirmation.data.properties!.hashed_token)}&type=signup&next=/dashboard`);
    await expect(page).toHaveURL(/\/dashboard\?signup=confirmed$/);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    // Production cookies are Secure. APIRequest does not send them over loopback HTTP,
    // unlike Chromium's trusted localhost handling; forward the in-memory cookies explicitly.
    authenticatedRequest = await request.newContext({ baseURL: "http://127.0.0.1:3000", extraHTTPHeaders: { Cookie: (await page.context().cookies()).map(cookie => `${cookie.name}=${cookie.value}`).join("; ") } });
    for (const path of ["/dashboard", "/account", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/confirm", "/diagnostic", "/checkout/success", "/api/health", "/api/auth/navigation", "/api/billing/access", "/api/billing/status"]) {
      privateResponse(await authenticatedRequest.get(path, { maxRedirects: 0 }));
    }
    const beforeNav = await authenticatedRequest.get("/api/auth/navigation");
    expect((await beforeNav.json()).userId).toBe(userId);
    const created = await authenticatedRequest.post("/api/diagnostic", { data: {} });
    expect(created.status()).toBe(201);
    privateResponse(created);
    sessionId = (await created.json()).sessionId;
    const owner = await service.from("study_sessions").select("user_id,anonymous_owner_hash").eq("id", sessionId).single();
    expect({ ownedByUser: owner.data?.user_id === userId, anonymous: !!owner.data?.anonymous_owner_hash }).toEqual({ ownedByUser: true, anonymous: false });
    for (let ordinal = 1; ordinal <= 20; ordinal++) {
      const progress = await authenticatedRequest.get(`/api/diagnostic/${sessionId}`);
      privateResponse(progress);
      expect(progress.status(), await progress.text()).toBe(200);
      const { currentQuestion } = await progress.json();
      const answered = await authenticatedRequest.post(`/api/diagnostic/${sessionId}/answer`, { data: { itemId: currentQuestion.id, selectedLabel: currentQuestion.options[0].label } });
      expect(answered.status()).toBe(200);
      privateResponse(answered);
    }
    for (const path of [`/diagnostic/${sessionId}`, `/diagnostic/${sessionId}/results`, `/api/diagnostic/${sessionId}/results`]) {
      const response = await authenticatedRequest.get(path);
      expect(response.status()).toBe(200);
      privateResponse(response);
    }
    const nav = await authenticatedRequest.get("/api/auth/navigation");
    expect((await nav.json()).userId).toBe(userId);
    const recovery = await service.auth.admin.generateLink({ type: "recovery", email });
    expect(recovery.error).toBeNull();
    const freshContext = await page.context().browser()!.newContext({ baseURL: "http://127.0.0.1:3000" });
    try {
      const other = await freshContext.newPage();
      await other.goto(`/auth/confirm?token_hash=${encodeURIComponent(recovery.data.properties!.hashed_token)}&type=recovery&next=/reset-password`);
      await expect(other).toHaveURL(/\/reset-password$/);
      await other.getByLabel("New password", { exact: true }).fill(`${password}-new`);
      await other.getByRole("button", { name: "Update password", exact: true }).click();
      await expect(other).toHaveURL(/\/dashboard(?:\?.*)?$/);
    } finally { await freshContext.close(); }
    for (const path of ["/", "/blog", "/blog/5-hardest-pmle-questions", "/faq", "/faq/how-long-is-the-google-ml-engineer-exam", "/pricing"]) {
      const response = await authenticatedRequest.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toMatch(/s-maxage=300(?:,|$)/);
      expect(response.headers()["set-cookie"]).toBeUndefined();
      expect(await response.text()).not.toContain(userId);
    }
  } finally {
    await authenticatedRequest?.dispose();
    if (sessionId) await service.from("study_sessions").delete().eq("id", sessionId);
    expect((await service.auth.admin.deleteUser(userId)).error).toBeNull();
  }
});
