import { test, expect, type APIRequestContext, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const MAILPIT = "http://127.0.0.1:56544/api/v1";

function localService() {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  expect(url.port).toBe("56541");
  return createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Every /auth/confirm link of this type sent to the address, newest first, once at least `count` exist. */
async function mailLinks(request: APIRequestContext, email: string, type: "signup" | "recovery", count: number) {
  let links: string[] = [];
  await expect.poll(async () => {
    const mailbox = await (await request.get(`${MAILPIT}/messages`)).json() as { messages: { ID: string; Created: string; To: { Address: string }[] }[] };
    const messages = mailbox.messages.filter(message => message.To.some(to => to.Address.toLowerCase() === email))
      .sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created));
    links = [];
    for (const message of messages) {
      const details = await (await request.get(`${MAILPIT}/message/${encodeURIComponent(message.ID)}`)).json() as { HTML: string; Text: string };
      expect(details.HTML + details.Text).not.toMatch(/enter the code/i);
      for (const match of details.HTML.matchAll(/href=["']([^"']+)["']/g)) {
        const candidate = new URL(match[1].replaceAll("&amp;", "&"));
        if (candidate.pathname !== "/auth/confirm" || candidate.searchParams.get("type") !== type) continue;
        expect(candidate.origin).toBe("http://127.0.0.1:3000");
        expect(candidate.searchParams.get("token_hash")).toBeTruthy();
        if (type === "signup") {
          const redirectTo = new URL(candidate.searchParams.get("redirect_to")!);
          expect(redirectTo.origin).toBe(candidate.origin);
          expect(redirectTo.pathname).toBe("/auth/confirm");
          expect(redirectTo.searchParams.get("next")).toBe("/dashboard");
        } else expect(candidate.searchParams.get("next")).toBe("/reset-password");
        links.push(candidate.href);
      }
    }
    return links.length;
  }, { timeout: 30_000, message: `Expected ${count} local ${type} email(s)` }).toBeGreaterThanOrEqual(count);
  return links;
}

/** A fresh context has no PKCE verifier, auth cookie or anonymous cookie: another browser or device. */
async function inFreshBrowser<T>(browser: Browser, run: (page: import("@playwright/test").Page) => Promise<T>) {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
  try { return await run(await context.newPage()); } finally { await context.close(); }
}

test("confirm and reset links work in another browser; unconfirmed sign-in and expired links offer a new email", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const service = localService();
  const email = `v2-email-${randomUUID()}@example.test`;
  const password = `Testero-${randomUUID()}-Aa9`;
  try {
    await page.goto("/signup?next=%2Fdashboard");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeVisible();
    const success = page.getByRole("status").filter({ has: page.getByRole("heading", { name: "Check your email", exact: true }) });
    await expect(success).toContainText("Already have an account? Sign in or reset your password.");
    await expect(success.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login");
    await expect(success.getByRole("link", { name: "reset your password", exact: true })).toHaveAttribute("href", "/forgot-password");
    const signupMessage = await success.textContent();
    const [firstSignup] = await mailLinks(page.request, email, "signup", 1);

    // Unconfirmed and wrong-password attempts show the same message and resend form.
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Resend confirmation email", exact: true })).toHaveCount(0);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Unable to sign in. Check your details and try again.", { exact: true })).toBeVisible();
    await page.getByLabel("Email address", { exact: true }).fill(email);
    // Supabase enforces a per-user email interval (1s locally, 60s by default hosted).
    await page.waitForTimeout(2_000);
    await page.getByRole("button", { name: "Resend confirmation email", exact: true }).click();
    await expect(page.getByText(/If an account exists, we sent a new confirmation link/)).toBeVisible();
    const [latestSignup] = await mailLinks(page.request, email, "signup", 2);
    expect(latestSignup).not.toBe(firstSignup);

    // A wrong password stays generic.
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(`${password}-wrong`);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Unable to sign in. Check your details and try again.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resend confirmation email", exact: true })).toBeVisible();

    // B1: the newest link confirms in a browser that never requested it.
    await inFreshBrowser(browser, async other => {
      await other.goto(latestSignup);
      await expect(other).toHaveURL(/\/dashboard\?signup=confirmed$/);
      await expect(other.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    });
    // Confirmed accounts get exactly the same generic signup help, not an account-exists response.
    await page.goto("/signup");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(success).toHaveText(signupMessage!);
    await success.getByRole("link", { name: "reset your password", exact: true }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);

    // A superseded or used link explains itself and offers a new email.
    await inFreshBrowser(browser, async other => {
      await other.goto(firstSignup);
      await expect(other).toHaveURL(/\/login\?message=confirmation-failed$/);
      await expect(other.getByText(/confirmation link has expired or was already used/)).toBeVisible();
      await expect(other.getByRole("button", { name: "Resend confirmation email", exact: true })).toBeVisible();
    });

    // Recovery requested here, completed in another browser.
    await page.goto("/forgot-password");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send reset link", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeVisible();
    const [recovery] = await mailLinks(page.request, email, "recovery", 1);
    const newPassword = `${password}-new`;
    await inFreshBrowser(browser, async other => {
      await other.goto(recovery);
      await expect(other).toHaveURL(/\/reset-password$/);
      await other.getByLabel("New password", { exact: true }).fill(newPassword);
      await other.getByRole("button", { name: "Update password", exact: true }).click();
      await expect(other.getByRole("status").filter({ hasText: "Password updated" })).toContainText("Password updated", { timeout: 15_000 });
      await expect(other).toHaveURL(/\/(?:dashboard|login)\?.*password-updated/);
    });
    // A used reset link sends the reader to request a new one.
    await inFreshBrowser(browser, async other => {
      await other.goto(recovery);
      await expect(other).toHaveURL(/\/forgot-password\?message=confirmation-failed$/);
      await expect(other.getByText(/reset link has expired or was already used/)).toBeVisible();
      await expect(other.getByRole("button", { name: "Send reset link", exact: true })).toBeVisible();
    });
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  } finally {
    const users = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const userId = users.data.users.find(user => user.email === email)?.id;
    if (userId) expect((await service.auth.admin.deleteUser(userId)).error).toBeNull();
  }
});

test("a post-reset dashboard bounce explains that the password changed", async ({ page }) => {
  await page.goto("/dashboard?message=password-updated");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole("status").filter({ hasText: "Password updated" })).toHaveText("Password updated. Please sign in again with your new password.");
});
