import { isAdmin, getAdminUserIds, getAdminEmails } from "@/lib/auth/isAdmin";

describe("isAdmin", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getAdminUserIds", () => {
    it("should parse comma-separated user IDs from ADMIN_USER_IDS", () => {
      process.env.ADMIN_USER_IDS = "user-1,user-2,user-3";
      const ids = getAdminUserIds();
      expect(ids).toEqual(["user-1", "user-2", "user-3"]);
    });

    it("should handle whitespace in comma-separated list", () => {
      process.env.ADMIN_USER_IDS = "user-1, user-2 , user-3";
      const ids = getAdminUserIds();
      expect(ids).toEqual(["user-1", "user-2", "user-3"]);
    });

    it("should return empty array when ADMIN_USER_IDS is not set", () => {
      delete process.env.ADMIN_USER_IDS;
      const ids = getAdminUserIds();
      expect(ids).toEqual([]);
    });

    it("should return empty array when ADMIN_USER_IDS is empty string", () => {
      process.env.ADMIN_USER_IDS = "";
      const ids = getAdminUserIds();
      expect(ids).toEqual([]);
    });
  });

  describe("getAdminEmails", () => {
    it("should parse comma-separated emails from ADMIN_EMAILS", () => {
      process.env.ADMIN_EMAILS = "admin1@example.com,admin2@example.com";
      const emails = getAdminEmails();
      expect(emails).toEqual(["admin1@example.com", "admin2@example.com"]);
    });

    it("should handle whitespace in comma-separated list", () => {
      process.env.ADMIN_EMAILS = "admin1@example.com, admin2@example.com ";
      const emails = getAdminEmails();
      expect(emails).toEqual(["admin1@example.com", "admin2@example.com"]);
    });

    it("should return empty array when ADMIN_EMAILS is not set", () => {
      delete process.env.ADMIN_EMAILS;
      const emails = getAdminEmails();
      expect(emails).toEqual([]);
    });

    it("should return empty array when ADMIN_EMAILS is empty string", () => {
      process.env.ADMIN_EMAILS = "";
      const emails = getAdminEmails();
      expect(emails).toEqual([]);
    });
  });

  describe("isAdmin", () => {
    it("should return true for user ID in ADMIN_USER_IDS", () => {
      process.env.ADMIN_USER_IDS = "admin-user-1,admin-user-2";
      const user = { id: "admin-user-1", email: "user@example.com" };
      expect(isAdmin(user)).toBe(true);
    });

    it("should return true for user email in ADMIN_EMAILS", () => {
      process.env.ADMIN_EMAILS = "admin1@example.com,admin2@example.com";
      const user = { id: "regular-user", email: "admin1@example.com" };
      expect(isAdmin(user)).toBe(true);
    });

    it("should return true if user ID matches even when email doesn't", () => {
      process.env.ADMIN_USER_IDS = "admin-user-1";
      process.env.ADMIN_EMAILS = "admin@example.com";
      const user = { id: "admin-user-1", email: "different@example.com" };
      expect(isAdmin(user)).toBe(true);
    });

    it("should return true if email matches even when ID doesn't", () => {
      process.env.ADMIN_USER_IDS = "admin-user-1";
      process.env.ADMIN_EMAILS = "admin@example.com";
      const user = { id: "different-user", email: "admin@example.com" };
      expect(isAdmin(user)).toBe(true);
    });

    it("should return false for non-admin users", () => {
      process.env.ADMIN_USER_IDS = "admin-user-1";
      process.env.ADMIN_EMAILS = "admin@example.com";
      const user = { id: "regular-user", email: "regular@example.com" };
      expect(isAdmin(user)).toBe(false);
    });

    it("should return false when no admin env vars are set", () => {
      delete process.env.ADMIN_USER_IDS;
      delete process.env.ADMIN_EMAILS;
      const user = { id: "any-user", email: "any@example.com" };
      expect(isAdmin(user)).toBe(false);
    });

    it("should handle user without email", () => {
      process.env.ADMIN_USER_IDS = "admin-user-1";
      process.env.ADMIN_EMAILS = "admin@example.com";
      const user = { id: "admin-user-1" };
      expect(isAdmin(user)).toBe(true);
    });

    it("should handle user with undefined email", () => {
      process.env.ADMIN_USER_IDS = "admin-user-1";
      const user = { id: "admin-user-1", email: undefined };
      expect(isAdmin(user)).toBe(true);
    });

    it("should be case-sensitive for user IDs", () => {
      process.env.ADMIN_USER_IDS = "admin-user-1";
      const user = { id: "ADMIN-USER-1", email: "user@example.com" };
      expect(isAdmin(user)).toBe(false);
    });

    it("should be case-sensitive for emails", () => {
      process.env.ADMIN_EMAILS = "admin@example.com";
      const user = { id: "user-1", email: "ADMIN@example.com" };
      expect(isAdmin(user)).toBe(false);
    });
  });
});


