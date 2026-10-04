import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as confirm } from "@/app/auth/confirm/route";
import { AUTH_MESSAGES } from "@/lib/auth/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { claimAnonymousDiagnostics } from "@/lib/auth/claim";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
const mocks = vi.hoisted(() => ({
  signUp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  getUser: vi.fn(), verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(),
  cookie: undefined as string | undefined,
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: (name: string) => name === "testero_anon" && mocks.cookie ? { value: mocks.cookie } : undefined })) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: mocks })) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn(() => ({ marker: "service" })) }));
vi.mock("@/lib/auth/claim", () => ({ claimAnonymousDiagnostics: vi.fn(async () => 1) }));
const verified = { id: "verified-user", email_confirmed_at: "2026-10-03T00:00:00Z" };
const valid = { email: "learner@example.com", password: "12345678" };
function req(body: unknown, origin = "http://127.0.0.1:3000") { return new Request("http://127.0.0.1:3000/api/auth", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) }); }
function callback(query: string) { return new Request(`http://127.0.0.1:3000/auth/confirm?${query}`); }
beforeEach(() => {
  mocks.cookie = undefined;
  for (const key of ["signUp", "signInWithPassword", "resetPasswordForEmail", "updateUser", "signOut", "verifyOtp", "exchangeCodeForSession"] as const) mocks[key].mockReset().mockResolvedValue({ error: null, data: { user: verified } });
  mocks.getUser.mockReset().mockResolvedValue({ error: null, data: { user: verified } });
  vi.mocked(createServerSupabaseClient).mockReset().mockResolvedValue({ auth: mocks } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);
  vi.mocked(claimAnonymousDiagnostics).mockReset().mockResolvedValue(1);
});
describe("auth writes", () => {
  it.each([{ route: signup, body: valid }, { route: login, body: valid }, { route: forgot, body: { email: valid.email } }, { route: reset, body: { password: valid.password } }, { route: logout, body: {} }])("rejects foreign origin and unknown fields before clients %#", async ({ route, body }) => {
    expect((await route(req(body, "https://evil.example"))).status).toBe(403);
    expect((await route(req({ ...body, userId: "victim" }))).status).toBe(400);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(createServiceSupabaseClient).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => expect((await signup(new Request("http://localhost/api/auth", { method: "POST", body: "{" }))).status).toBe(400));
  it.each(["new", "duplicate", "error", "throw"])("signup is indistinguishable for %s and never claims signUp user", async kind => {
    mocks.cookie = "a".repeat(64);
    if (kind === "duplicate") mocks.signUp.mockResolvedValue({ error: null, data: { user: { id: "fake", identities: [] } } });
    if (kind === "error") mocks.signUp.mockResolvedValue({ error: { message: "Email already exists learner@example.com" } });
    if (kind === "throw") mocks.signUp.mockRejectedValue(new Error("private credential"));
    const response = await signup(req(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: AUTH_MESSAGES.signup });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(claimAnonymousDiagnostics).not.toHaveBeenCalled();
    expect(createServiceSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.signUp).toHaveBeenCalledWith({ ...valid, options: { emailRedirectTo: "http://127.0.0.1:3000/auth/confirm?next=%2Fdashboard&flow=signup" } });
  });
  it.each(["known", "unknown", "throw"])("forgot password is generic for %s", async kind => {
    if (kind === "unknown") mocks.resetPasswordForEmail.mockResolvedValue({ error: { message: "Unknown user learner@example.com" } });
    if (kind === "throw") mocks.resetPasswordForEmail.mockRejectedValue(new Error("private"));
    const response = await forgot(req({ email: valid.email }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ message: AUTH_MESSAGES.recovery });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(valid.email, { redirectTo: "http://127.0.0.1:3000/auth/confirm?next=%2Freset-password&flow=recovery" });
  });
  it.each([signup, forgot])("client failure still gives generic email response %#", async route => {
    vi.mocked(createServerSupabaseClient).mockRejectedValue(new Error("configuration private"));
    expect((await route(req(route === signup ? valid : { email: valid.email }))).status).toBe(200);
  });
  it("login verifies getUser before claiming with raw cookie and server identity", async () => {
    mocks.cookie = "a".repeat(64);
    const response = await login(req({ ...valid, next: "/practice" }));
    expect(await response.json()).toEqual({ message: "Signed in.", href: "/practice" });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(claimAnonymousDiagnostics).toHaveBeenCalledWith({ marker: "service" }, verified.id, mocks.cookie);
    expect(mocks.getUser.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(claimAnonymousDiagnostics).mock.invocationCallOrder[0]);
  });
  it.each([undefined, "invalid", "A".repeat(64)])("no service reads/claim for invalid or missing cookie %#", async cookie => {
    mocks.cookie = cookie;
    expect((await login(req(valid))).status).toBe(200);
    expect(createServiceSupabaseClient).not.toHaveBeenCalled(); expect(claimAnonymousDiagnostics).not.toHaveBeenCalled();
  });
  it.each(["missing", "unconfirmed", "error", "throw", "invalid-password"])("login denies %s without claims", async kind => {
    mocks.cookie = "a".repeat(64);
    if (kind === "missing") mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    if (kind === "unconfirmed") mocks.getUser.mockResolvedValue({ data: { user: { id: "fake" } }, error: null });
    if (kind === "error") mocks.getUser.mockResolvedValue({ data: { user: verified }, error: { message: "private" } });
    if (kind === "throw") mocks.getUser.mockRejectedValue(new Error("private"));
    if (kind === "invalid-password") mocks.signInWithPassword.mockResolvedValue({ error: { message: "Email missing learner@example.com" } });
    const response = await login(req(valid));
    expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: AUTH_MESSAGES.credentials });
    expect(claimAnonymousDiagnostics).not.toHaveBeenCalled(); expect(createServiceSupabaseClient).not.toHaveBeenCalled();
  });
  it("claim failures are generic and preserve the owner cookie for retry", async () => {
    mocks.cookie = "a".repeat(64);
    vi.mocked(claimAnonymousDiagnostics).mockRejectedValue(new Error("private RPC details"));
    const response = await login(req(valid));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: AUTH_MESSAGES.unavailable });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("reset requires a confirmed server user before update", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await reset(req({ password: valid.password }));
    expect(response.status).toBe(401); expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("reset updates password only and sanitizes SDK errors", async () => {
    let response = await reset(req({ password: valid.password }));
    expect(await response.json()).toEqual({ message: "Your password has been updated.", href: "/dashboard" });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: valid.password });
    mocks.updateUser.mockResolvedValue({ error: { message: "private password" } });
    response = await reset(req({ password: valid.password }));
    expect(await response.json()).toEqual({ error: AUTH_MESSAGES.unavailable });
  });
  it("logout uses local scope, never claims or touches anonymous ownership", async () => {
    mocks.cookie = "a".repeat(64);
    const response = await logout(req({}));
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(await response.json()).toEqual({ message: "Signed out.", href: "/" });
    expect(claimAnonymousDiagnostics).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("logout failure is generic", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "secret" } });
    expect(await (await logout(req({}))).json()).toEqual({ error: AUTH_MESSAGES.unavailable });
  });
});
describe("email confirmation and PKCE", () => {
  it.each(["", "type=signup", "token_hash=bad&type=signup", `token_hash=${"a".repeat(64)}&type=email`, "code=abcdefgh&code=ijklmnop", "code=abcdefgh&unknown=field"])("rejects invalid parameters before SDK %#", async query => {
    const response = await confirm(callback(query));
    expect(response.status).toBe(303); expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/login?message=confirmation-failed");
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
  it("confirmed signup claims only verified identity and redirects safely with marker", async () => {
    mocks.cookie = "b".repeat(64);
    const response = await confirm(callback(`token_hash=${"a".repeat(64)}&type=signup&flow=signup&next=%2F%2Fevil.example`));
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "a".repeat(64), type: "signup" });
    expect(claimAnonymousDiagnostics).toHaveBeenCalledWith({ marker: "service" }, verified.id, mocks.cookie);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/dashboard?signup=confirmed");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
  it.each(["hash", "PKCE"])("forces recovery to reset-password: %s", async kind => {
    const query = kind === "hash" ? `token_hash=${"a".repeat(64)}&type=recovery` : "code=abcdefgh&flow=recovery";
    const response = await confirm(callback(`${query}&next=%2Fpractice`));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/reset-password");
    expect(claimAnonymousDiagnostics).not.toHaveBeenCalled();
  });
  it("exchanges PKCE code, verifies and claims", async () => {
    mocks.cookie = "c".repeat(64);
    const response = await confirm(callback("code=abcdefgh&flow=signup"));
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abcdefgh"); expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(claimAnonymousDiagnostics).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toContain("/dashboard?signup=confirmed");
  });
  it.each(["otp-error", "otp-throw", "unconfirmed", "verified-error", "claim-error"])("generic failed callback %s never leaks tokens/errors", async kind => {
    mocks.cookie = "a".repeat(64);
    if (kind === "otp-error") mocks.verifyOtp.mockResolvedValue({ error: { message: "private token" } });
    if (kind === "otp-throw") mocks.verifyOtp.mockRejectedValue(new Error("private token"));
    if (kind === "unconfirmed") mocks.getUser.mockResolvedValue({ data: { user: { id: "fake" } }, error: null });
    if (kind === "verified-error") mocks.getUser.mockResolvedValue({ data: { user: verified }, error: { message: "private" } });
    if (kind === "claim-error") vi.mocked(claimAnonymousDiagnostics).mockRejectedValue(new Error("private RPC"));
    const response = await confirm(callback(`token_hash=${"a".repeat(64)}&type=signup`));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/login?message=confirmation-failed");
    if (kind !== "claim-error") expect(createServiceSupabaseClient).not.toHaveBeenCalled();
  });
});
