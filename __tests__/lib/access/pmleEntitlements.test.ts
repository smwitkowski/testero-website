import {
  getAccessLevel,
  canUseFeature,
  getPmleAccessLevelForUser,
  type AccessLevel,
  type PmleFeature,
} from "@/lib/access/pmleEntitlements";
import type { User } from "@supabase/supabase-js";
import type { BillingStatusResponse } from "@/app/api/billing/status/route";

// Mock user for testing
const mockUser: User = {
  id: "test-user-id",
  email: "test@example.com",
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  confirmation_sent_at: null,
  recovery_sent_at: null,
  email_confirmed_at: new Date().toISOString(),
  invited_at: null,
  action_link: null,
  phone: null,
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  role: "authenticated",
  updated_at: new Date().toISOString(),
  phone_confirmed_at: null,
  is_anonymous: false,
};

describe("pmleEntitlements", () => {
  describe("getAccessLevel", () => {
    it("returns ANONYMOUS when user is null", () => {
      const level = getAccessLevel({ user: null, isSubscriber: false });
      expect(level).toBe("ANONYMOUS");
    });

    it("returns ANONYMOUS when user is null even if isSubscriber is true", () => {
      const level = getAccessLevel({ user: null, isSubscriber: true });
      expect(level).toBe("ANONYMOUS");
    });

    it("returns FREE when user exists but isSubscriber is false", () => {
      const level = getAccessLevel({ user: mockUser, isSubscriber: false });
      expect(level).toBe("FREE");
    });

    it("returns SUBSCRIBER when user exists and isSubscriber is true", () => {
      const level = getAccessLevel({ user: mockUser, isSubscriber: true });
      expect(level).toBe("SUBSCRIBER");
    });
  });

  describe("canUseFeature", () => {
    describe("ANONYMOUS access level", () => {
      it("allows DIAGNOSTIC_RUN", () => {
        expect(canUseFeature("ANONYMOUS", "DIAGNOSTIC_RUN")).toBe(true);
      });

      it("allows DIAGNOSTIC_SUMMARY_BASIC", () => {
        expect(canUseFeature("ANONYMOUS", "DIAGNOSTIC_SUMMARY_BASIC")).toBe(
          true
        );
      });

      it("denies DIAGNOSTIC_SUMMARY_FULL", () => {
        expect(canUseFeature("ANONYMOUS", "DIAGNOSTIC_SUMMARY_FULL")).toBe(
          false
        );
      });

      it("denies EXPLANATIONS", () => {
        expect(canUseFeature("ANONYMOUS", "EXPLANATIONS")).toBe(false);
      });

      it("denies PRACTICE_SESSION", () => {
        expect(canUseFeature("ANONYMOUS", "PRACTICE_SESSION")).toBe(false);
      });

      it("denies PRACTICE_SESSION_FREE_QUOTA", () => {
        expect(
          canUseFeature("ANONYMOUS", "PRACTICE_SESSION_FREE_QUOTA")
        ).toBe(false);
      });
    });

    describe("FREE access level", () => {
      it("allows DIAGNOSTIC_RUN", () => {
        expect(canUseFeature("FREE", "DIAGNOSTIC_RUN")).toBe(true);
      });

      it("allows DIAGNOSTIC_SUMMARY_BASIC", () => {
        expect(canUseFeature("FREE", "DIAGNOSTIC_SUMMARY_BASIC")).toBe(true);
      });

      it("allows DIAGNOSTIC_SUMMARY_FULL", () => {
        expect(canUseFeature("FREE", "DIAGNOSTIC_SUMMARY_FULL")).toBe(true);
      });

      it("denies EXPLANATIONS", () => {
        expect(canUseFeature("FREE", "EXPLANATIONS")).toBe(false);
      });

      it("denies PRACTICE_SESSION", () => {
        expect(canUseFeature("FREE", "PRACTICE_SESSION")).toBe(false);
      });

      it("allows PRACTICE_SESSION_FREE_QUOTA", () => {
        expect(canUseFeature("FREE", "PRACTICE_SESSION_FREE_QUOTA")).toBe(
          true
        );
      });
    });

    describe("SUBSCRIBER access level", () => {
      const features: PmleFeature[] = [
        "DIAGNOSTIC_RUN",
        "DIAGNOSTIC_SUMMARY_BASIC",
        "DIAGNOSTIC_SUMMARY_FULL",
        "EXPLANATIONS",
        "PRACTICE_SESSION",
        "PRACTICE_SESSION_FREE_QUOTA",
      ];

      it.each(features)("allows %s", (feature) => {
        expect(canUseFeature("SUBSCRIBER", feature)).toBe(true);
      });
    });
  });

  describe("getPmleAccessLevelForUser", () => {
    it("returns ANONYMOUS when user is null", () => {
      const level = getPmleAccessLevelForUser(null, null);
      expect(level).toBe("ANONYMOUS");
    });

    it("returns ANONYMOUS when user is null even with billing status", () => {
      const billingStatus: BillingStatusResponse = {
        isSubscriber: true,
        status: "active",
      };
      const level = getPmleAccessLevelForUser(null, billingStatus);
      expect(level).toBe("ANONYMOUS");
    });

    it("returns FREE when user exists but billing status is null", () => {
      const level = getPmleAccessLevelForUser(mockUser, null);
      expect(level).toBe("FREE");
    });

    it("returns FREE when user exists but isSubscriber is false", () => {
      const billingStatus: BillingStatusResponse = {
        isSubscriber: false,
        status: "none",
      };
      const level = getPmleAccessLevelForUser(mockUser, billingStatus);
      expect(level).toBe("FREE");
    });

    it("returns SUBSCRIBER when user exists and isSubscriber is true", () => {
      const billingStatus: BillingStatusResponse = {
        isSubscriber: true,
        status: "active",
      };
      const level = getPmleAccessLevelForUser(mockUser, billingStatus);
      expect(level).toBe("SUBSCRIBER");
    });
  });
});

