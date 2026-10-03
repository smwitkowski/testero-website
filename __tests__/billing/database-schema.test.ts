/** @jest-environment node */
import { readFileSync } from "fs";
import { join } from "path";

// Offline migration contracts. These inspect DDL, not a deployed database's state.
// An isolated Supabase integration harness is required to verify runtime constraints.
const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20250106_create_billing_tables.sql"),
  "utf8"
);
const threeMonthMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20251223_add_three_month_pricing.sql"),
  "utf8"
);

function tableDefinition(table: string): string {
  const definition = migration.match(
    new RegExp(String.raw`CREATE TABLE IF NOT EXISTS ${table} \(([\s\S]*?)\n\);`)
  );
  if (!definition) throw new Error(`Missing table definition: ${table}`);
  return definition[1];
}

describe("Billing Database Schema migrations", () => {
  describe("subscription_plans table", () => {
    test("declares required columns", () => {
      const table = tableDefinition("subscription_plans");
      expect(table).toMatch(/id UUID PRIMARY KEY/);
      expect(table).toMatch(/name TEXT NOT NULL/);
      expect(table).toMatch(/price_monthly INTEGER NOT NULL CHECK \(price_monthly > 0\)/);
      expect(table).toMatch(/features JSONB NOT NULL/);
    });

    test("declares unique constraints on stripe_price_ids", () => {
      const table = tableDefinition("subscription_plans");
      expect(table).toMatch(/stripe_price_id_monthly TEXT UNIQUE/);
      expect(table).toMatch(/stripe_price_id_yearly TEXT UNIQUE/);
      expect(threeMonthMigration).toMatch(
        /ADD COLUMN IF NOT EXISTS stripe_price_id_three_month TEXT UNIQUE/
      );
    });
  });

  describe("user_subscriptions table", () => {
    test("declares required columns and foreign keys", () => {
      const table = tableDefinition("user_subscriptions");
      expect(table).toMatch(/id UUID PRIMARY KEY/);
      expect(table).toMatch(/plan_id UUID REFERENCES subscription_plans\(id\)/);
      expect(table).toMatch(/status TEXT NOT NULL CHECK/);
      for (const status of [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
      ]) {
        expect(table).toContain(`'${status}'`);
      }
    });

    test("declares unique constraint on stripe_customer_id", () => {
      expect(tableDefinition("user_subscriptions")).toMatch(
        /stripe_customer_id TEXT UNIQUE NOT NULL/
      );
    });

    test("declares cascade delete when user is deleted", () => {
      expect(tableDefinition("user_subscriptions")).toMatch(
        /user_id UUID REFERENCES auth\.users\(id\) ON DELETE CASCADE/
      );
    });
  });

  describe("payment_history table", () => {
    test("declares payment records with proper structure", () => {
      const table = tableDefinition("payment_history");
      expect(table).toMatch(/user_id UUID REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
      expect(table).toMatch(/stripe_payment_intent_id TEXT UNIQUE/);
      expect(table).toMatch(/amount INTEGER NOT NULL/);
      expect(table).toMatch(/currency TEXT NOT NULL/);
      expect(table).toMatch(/status TEXT NOT NULL/);
      expect(table).toMatch(/receipt_url TEXT/);
    });
  });

  describe("webhook_events table", () => {
    test("declares event idempotency constraint", () => {
      const table = tableDefinition("webhook_events");
      expect(table).toMatch(/stripe_event_id TEXT UNIQUE NOT NULL/);
      expect(table).toMatch(/type TEXT NOT NULL/);
    });

    test("declares processing status and error fields", () => {
      const table = tableDefinition("webhook_events");
      expect(table).toMatch(/processed BOOLEAN DEFAULT false/);
      expect(table).toMatch(/error TEXT/);
      expect(table).toMatch(/processed_at TIMESTAMP WITH TIME ZONE/);
    });
  });
});
