import { StripeService } from "@/lib/stripe/stripe-service";
import Stripe from "stripe";
jest.mock("stripe");

describe("Retired trial feature regression", () => {
  let service: StripeService;
  const create = jest.fn();
  const createSubscription = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.STRIPE_PRICE_PMLE_PASS = "price_pass";
    create.mockResolvedValue({ id: "cs_pass" });
    (Stripe as jest.Mock).mockImplementation(() => ({
      checkout: { sessions: { create } },
      subscriptions: { create: createSubscription },
    }));
    service = new StripeService();
  });
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_PMLE_PASS;
  });
  const buyPass = () =>
    service.createCheckoutSession({
      customerId: "cus_pass",
      userId: "user_pass",
      successUrl: "https://example.test/success",
      cancelUrl: "https://example.test/pricing",
    });
  test("does not expose trial subscription provisioning", () => {
    expect("createTrialSubscription" in service).toBe(false);
  });
  test("does not default to any trial period", async () => {
    await buyPass();
    const params = create.mock.calls[0][0];
    expect(params).not.toHaveProperty("trial_period_days");
    expect(params).not.toHaveProperty("subscription_data");
  });
  test("does not fall back to a trial if pass configuration is absent", async () => {
    delete process.env.STRIPE_PRICE_PMLE_PASS;
    await expect(buyPass()).rejects.toThrow("STRIPE_PRICE_PMLE_PASS");
    expect(createSubscription).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  test("new checkout has no subscription or trial promotion path", async () => {
    await buyPass();
    expect(create.mock.calls[0][0].mode).toBe("payment");
    expect(create.mock.calls[0][0]).not.toHaveProperty("allow_promotion_codes");
    expect(createSubscription).not.toHaveBeenCalled();
  });
  test("does not expose trial-to-paid conversion", () => {
    expect("convertTrialToPaid" in service).toBe(false);
  });
});
