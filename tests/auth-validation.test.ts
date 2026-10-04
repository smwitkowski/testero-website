import { describe, expect, it } from "vitest";
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, logoutSchema, confirmationSchema } from "@/lib/auth/validation";
import { safeNext, signupDestination } from "@/lib/auth/redirects";
const valid = { email: "learner@example.com", password: "12345678" };
describe("strict auth bodies", () => {
  it("normalizes email and defaults to the dashboard", () => {
    expect(signupSchema.parse({ ...valid, email: " learner@example.com " })).toEqual({ ...valid, next: "/dashboard" });
  });
  it.each(["", "bad", "learner@", "@example.com", "x".repeat(255) + "@example.com"])("rejects malformed email %s", email => {
    expect(signupSchema.safeParse({ ...valid, email }).success).toBe(false);
  });
  it.each(["", "1234567", "x".repeat(73)])("rejects password length %#", password => {
    expect(signupSchema.safeParse({ ...valid, password }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password }).success).toBe(false);
  });
  it.each([8, 72])("accepts password boundary %s", count => expect(loginSchema.safeParse({ ...valid, password: "x".repeat(count) }).success).toBe(true));
  it.each(["userId", "anonymousToken", "role", "identities"])("rejects unknown signup/login fields %s", field => {
    expect(signupSchema.safeParse({ ...valid, [field]: "fake" }).success).toBe(false);
    expect(loginSchema.safeParse({ ...valid, [field]: "fake" }).success).toBe(false);
  });
  it("rejects extra fields in all other bodies", () => {
    expect(forgotPasswordSchema.safeParse({ email: valid.email, userId: "fake" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: valid.password, userId: "fake" }).success).toBe(false);
    expect(logoutSchema.safeParse({ userId: "fake" }).success).toBe(false);
  });
  it.each([null, [], "", 42])("rejects non-objects %#", body => expect(signupSchema.safeParse(body).success).toBe(false));
});
describe("safe local redirects", () => {
  it.each([undefined, null, "https://evil.example", "//evil.example", "/\\evil.example", "/%2f%2fevil.example", "/%5cevil.example", "/%255cevil.example", "/%252f%252fevil.example", "/%0aevil", "/%250devil", "/javascript:evil", "/%6aavascript%3aevil", "/path with space", "/bad%", "/a/..//evil.example", "/.//evil.example", "/%2e//evil.example", "/a/%2e%2e//evil.example", "/a/%252e%252e//evil.example", "x".repeat(2049)])("rejects unsafe next %#", value => expect(safeNext(value)).toBe("/dashboard"));
  it.each(["/account", "/practice?domain=ml", "/diagnostic/abc/results#review", "/dashboard?tab=ready"])("keeps internal path %s", value => expect(safeNext(value)).toBe(value));
  it("does not emit a protocol-relative signup destination after path normalization", () => expect(signupDestination("/a/..//evil.example")).toBe("/dashboard?signup=confirmed"));
  it("adds one verified signup marker without dropping query or fragment", () => expect(signupDestination("/dashboard?tab=ready&signup=other#top")).toBe("/dashboard?tab=ready&signup=confirmed#top"));
});
describe("callback validation", () => {
  it.each([{}, { type: "signup" }, { token_hash: "a".repeat(64) }, { token_hash: "a".repeat(64), type: "email" }, { token_hash: "a".repeat(64), type: "signup", flow: "recovery" }, { token_hash: "a".repeat(64), type: "signup", code: "abcdefgh" }, { code: "abcdefgh", userId: "foreign" }, { code: "bad" }])("rejects invalid/ambiguous callback %#", params => expect(confirmationSchema.safeParse(params).success).toBe(false));
  it.each(["signup", "recovery"])("accepts hash callback %s", type => expect(confirmationSchema.safeParse({ token_hash: "a".repeat(64), type }).success).toBe(true));
  it("accepts PKCE", () => expect(confirmationSchema.safeParse({ code: "abcd1234-abcd-1234" }).success).toBe(true));
});
