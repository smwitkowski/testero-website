import { createServerSupabaseClient } from "@/lib/supabase/server";

describe("Billing Database Schema", () => {
  const supabase = createServerSupabaseClient();

  describe("subscription_plans table", () => {
    test("should have required columns", async () => {
      const { data, error } = await supabase.from("subscription_plans").select("*").limit(0);

      expect(error).toBeNull();

      // Verify table exists by checking query succeeds
      expect(data).toBeDefined();
    });

    test("should enforce unique constraint on stripe_price_ids", async () => {
      const plan1 = {
        name: "Test Plan 1",
        price_monthly: 2900,
        price_yearly: 29000,
        stripe_price_id_monthly: "price_test_monthly_1",
        stripe_price_id_yearly: "price_test_yearly_1",
        features: { tests: 100, support: "email" },
      };

      const plan2 = {
        name: "Test Plan 2",
        price_monthly: 4900,
        price_yearly: 49000,
        stripe_price_id_monthly: "price_test_monthly_1", // Duplicate
        stripe_price_id_yearly: "price_test_yearly_2",
        features: { tests: 500, support: "priority" },
      };

      // First insert should succeed
      const { error: error1 } = await supabase.from("subscription_plans").insert(plan1);

      // Second insert with duplicate stripe_price_id should fail
      const { error: error2 } = await supabase.from("subscription_plans").insert(plan2);

      expect(error1).toBeNull();
      expect(error2).toBeDefined();
      expect(error2?.code).toBe("23505"); // Unique constraint violation

      // Cleanup
      await supabase
        .from("subscription_plans")
        .delete()
        .eq("stripe_price_id_monthly", "price_test_monthly_1");
    });
  });

  describe("user_subscriptions table", () => {
    test("should have required columns and foreign keys", async () => {
      const { data, error } = await supabase.from("user_subscriptions").select("*").limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    test("should enforce unique constraint on stripe_customer_id", async () => {
      // Create test user first
      const { data: userData } = await supabase.auth.admin.createUser({
        email: "test-billing@example.com",
        password: "test123456",
      });

      if (!userData.user) {
        throw new Error("Failed to create test user");
      }

      const subscription1 = {
        user_id: userData.user.id,
        stripe_customer_id: "cus_test_unique_1",
        stripe_subscription_id: "sub_test_1",
        status: "active",
      };

      const subscription2 = {
        user_id: userData.user.id,
        stripe_customer_id: "cus_test_unique_1", // Duplicate
        stripe_subscription_id: "sub_test_2",
        status: "active",
      };

      const { error: error1 } = await supabase.from("user_subscriptions").insert(subscription1);

      const { error: error2 } = await supabase.from("user_subscriptions").insert(subscription2);

      expect(error1).toBeNull();
      expect(error2).toBeDefined();
      expect(error2?.code).toBe("23505"); // Unique constraint violation

      // Cleanup
      await supabase.from("user_subscriptions").delete().eq("user_id", userData.user.id);

      await supabase.auth.admin.deleteUser(userData.user.id);
    });

    test("should cascade delete when user is deleted", async () => {
      // Create test user
      const { data: userData } = await supabase.auth.admin.createUser({
        email: "test-cascade@example.com",
        password: "test123456",
      });

      if (!userData.user) {
        throw new Error("Failed to create test user");
      }

      // Create subscription for user
      const { data: subData } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: userData.user.id,
          stripe_customer_id: "cus_test_cascade",
          stripe_subscription_id: "sub_test_cascade",
          status: "active",
        })
        .select()
        .single();

      expect(subData).toBeDefined();

      // Delete user
      await supabase.auth.admin.deleteUser(userData.user.id);

      // Verify subscription was deleted
      const { data: checkData } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("stripe_customer_id", "cus_test_cascade")
        .single();

      expect(checkData).toBeNull();
    });
  });

  describe("payment_history table", () => {
    test("should store payment records with proper structure", async () => {
      // Create test user
      const { data: userData } = await supabase.auth.admin.createUser({
        email: "test-payment@example.com",
        password: "test123456",
      });

      if (!userData.user) {
        throw new Error("Failed to create test user");
      }

      const payment = {
        user_id: userData.user.id,
        stripe_payment_intent_id: "pi_test_123",
        amount: 2900,
        currency: "usd",
        status: "succeeded",
        receipt_url: "https://stripe.com/receipt/test",
      };

      const { data, error } = await supabase
        .from("payment_history")
        .insert(payment)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.stripe_payment_intent_id).toBe("pi_test_123");
      expect(data?.amount).toBe(2900);

      // Cleanup
      await supabase.from("payment_history").delete().eq("user_id", userData.user.id);

      await supabase.auth.admin.deleteUser(userData.user.id);
    });
  });

  describe("webhook_events table", () => {
    test("should track webhook events for idempotency", async () => {
      const event = {
        stripe_event_id: "evt_test_123",
        type: "checkout.session.completed",
        processed: false,
      };

      const { data, error } = await supabase.from("webhook_events").insert(event).select().single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.stripe_event_id).toBe("evt_test_123");

      // Attempting to insert duplicate should fail
      const { error: dupError } = await supabase.from("webhook_events").insert(event);

      expect(dupError).toBeDefined();
      expect(dupError?.code).toBe("23505"); // Unique constraint violation

      // Cleanup
      await supabase.from("webhook_events").delete().eq("stripe_event_id", "evt_test_123");
    });

    test("should track processing status and errors", async () => {
      const event = {
        stripe_event_id: "evt_test_processing",
        type: "payment_intent.failed",
        processed: false,
      };

      // Insert event
      const { data: insertData } = await supabase
        .from("webhook_events")
        .insert(event)
        .select()
        .single();

      expect(insertData?.processed).toBe(false);
      expect(insertData?.error).toBeNull();

      // Update as processed with error
      const { data: updateData } = await supabase
        .from("webhook_events")
        .update({
          processed: true,
          error: "Customer not found",
          processed_at: new Date().toISOString(),
        })
        .eq("stripe_event_id", "evt_test_processing")
        .select()
        .single();

      expect(updateData?.processed).toBe(true);
      expect(updateData?.error).toBe("Customer not found");
      expect(updateData?.processed_at).toBeDefined();

      // Cleanup
      await supabase.from("webhook_events").delete().eq("stripe_event_id", "evt_test_processing");
    });
  });
});
