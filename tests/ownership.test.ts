import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import * as crypto from "node:crypto";
import {
  ANONYMOUS_COOKIE_MAX_AGE, canAccessSession, createAnonymousToken,
  hashAnonymousToken, ownsSession,
} from "@/lib/diagnostic/ownership";

vi.mock("node:crypto", async (original) => {
  const actual = await original<typeof import("node:crypto")>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});
const token = "a".repeat(64);
const ownerHash = createHash("sha256").update(token).digest("hex");
const credentials = { userId: null, anonymousToken: token };
const anonymousOwner = { user_id: null, anonymous_owner_hash: ownerHash };

describe("server-owned diagnostic credentials", () => {
  it("creates distinct cryptographic 32-byte hex tokens", () => {
    const first = createAnonymousToken();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(createAnonymousToken()).not.toBe(first);
    expect(ANONYMOUS_COOKIE_MAX_AGE).toBe(30 * 24 * 60 * 60);
  });
  it("hashes valid tokens instead of storing the bearer token", () => {
    expect(hashAnonymousToken(token)).toBe(ownerHash);
    expect(ownerHash).not.toBe(token);
  });
  it.each([null, undefined, "", "a".repeat(63), "a".repeat(65), "G".repeat(64), "A".repeat(64)])
    ("rejects invalid token %#", (value) => expect(hashAnonymousToken(value)).toBeNull());
  it("compares valid anonymous hashes with timingSafeEqual", () => {
    vi.mocked(crypto.timingSafeEqual).mockClear();
    expect(ownsSession(anonymousOwner, credentials)).toBe(true);
    expect(crypto.timingSafeEqual).toHaveBeenCalledOnce();
    expect(crypto.timingSafeEqual).toHaveBeenCalledWith(Buffer.from(ownerHash, "hex"), Buffer.from(ownerHash, "hex"));
  });
  it("denies a different valid anonymous token", () => {
    expect(ownsSession(anonymousOwner, { ...credentials, anonymousToken: "b".repeat(64) })).toBe(false);
  });
  it.each([null, "", "bad", "f".repeat(63), "G".repeat(64)])("denies malformed owner hash %#", (hash) => {
    expect(ownsSession({ user_id: null, anonymous_owner_hash: hash }, credentials)).toBe(false);
  });
  it("denies missing or invalid supplied tokens without comparing hashes", () => {
    vi.mocked(crypto.timingSafeEqual).mockClear();
    expect(ownsSession(anonymousOwner, { userId: "user", anonymousToken: null })).toBe(false);
    expect(ownsSession(anonymousOwner, { userId: null, anonymousToken: "invalid" })).toBe(false);
    expect(crypto.timingSafeEqual).not.toHaveBeenCalled();
  });
  it("accepts only a matching verified user ID for signed ownership", () => {
    const owner = { user_id: "user-a", anonymous_owner_hash: null };
    expect(ownsSession(owner, { userId: "user-a", anonymousToken: null })).toBe(true);
    expect(ownsSession(owner, { userId: "user-b", anonymousToken: token })).toBe(false);
    expect(ownsSession(owner, credentials)).toBe(false);
  });
  it("denies zero or two owners", () => {
    expect(ownsSession({ user_id: null, anonymous_owner_hash: null }, credentials)).toBe(false);
    expect(ownsSession({ user_id: "user-a", anonymous_owner_hash: ownerHash }, { userId: "user-a", anonymousToken: token })).toBe(false);
  });
  it("denies malformed empty-string owner values instead of treating them as null", () => {
    expect(ownsSession({ user_id: "user-a", anonymous_owner_hash: "" }, { userId: "user-a", anonymousToken: token })).toBe(false);
    expect(ownsSession({ user_id: "", anonymous_owner_hash: ownerHash }, credentials)).toBe(false);
  });
  it("checks ownership before expiry, and allows completed owned results after expiry", () => {
    const now = Date.parse("2026-10-03T12:00:00Z");
    const expired = { ...anonymousOwner, expires_at: "2026-10-03T11:00:00Z", completed_at: null };
    expect(canAccessSession(expired, credentials, now)).toBe(false);
    expect(canAccessSession({ ...expired, completed_at: "2026-10-03T10:00:00Z" }, credentials, now)).toBe(true);
    expect(canAccessSession({ ...expired, completed_at: "2026-10-03T10:00:00Z" }, { ...credentials, anonymousToken: "b".repeat(64) }, now)).toBe(false);
    expect(canAccessSession({ ...expired, expires_at: "invalid" }, credentials, now)).toBe(false);
    expect(canAccessSession({ ...expired, expires_at: "2026-10-04T12:00:00Z" }, credentials, now)).toBe(true);
  });
});
