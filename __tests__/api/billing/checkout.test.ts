jest.mock("next/server", () => ({
  NextRequest: jest.fn().mockImplementation((url, init) => ({
    headers: { get: jest.fn((name) => init?.headers?.[name]) },
    json: jest.fn(async () => JSON.parse(init?.body)),
  })),
  NextResponse: {
    json: jest.fn((data, init) => ({ json: async () => data, status: init?.status || 200 })),
  },
}));
jest.mock("@/lib/stripe/stripe-service");
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/auth/rate-limiter");
import { StripeService } from "@/lib/stripe/stripe-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/auth/rate-limiter";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/billing/checkout/route";

describe("PMLE Pass checkout API", () => {
  const getUser = jest.fn();
  const createCustomer = jest.fn();
  const createSession = jest.fn();
  const from = jest.fn();
  const request = (body: unknown = {}, headers = {}) =>
    new NextRequest("http://localhost/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_PRICE_PMLE_PASS = "price_server_pass";
    process.env.NEXT_PUBLIC_SITE_URL = "https://testero.ai";
    getUser.mockResolvedValue({
      data: { user: { id: "user_123", email: "test@example.com" } },
      error: null,
    });
    createCustomer.mockResolvedValue({ id: "cus_123" });
    createSession.mockResolvedValue({
      id: "cs_123",
      url: "https://checkout.stripe.com/pay/cs_123",
    });
    (StripeService as jest.Mock).mockImplementation(() => ({
      createOrRetrieveCustomer: createCustomer,
      createCheckoutSession: createSession,
    }));
    (createServerSupabaseClient as jest.Mock).mockReturnValue({ auth: { getUser }, from });
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
  });
  afterEach(() => {
    delete process.env.STRIPE_PRICE_PMLE_PASS;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });
  test("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(createSession).not.toHaveBeenCalled();
  });
  test("rejects authentication errors", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user_123" } },
      error: new Error("invalid auth"),
    });
    expect((await POST(request())).status).toBe(401);
  });
  test("allows authenticated checkout using only the server price", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.com/pay/cs_123" });
    expect(createCustomer).toHaveBeenCalledWith("user_123", "test@example.com");
    expect(createSession).toHaveBeenCalledWith({
      customerId: "cus_123",
      priceId: "price_server_pass",
      userId: "user_123",
      successUrl:
        "https://testero.ai/api/billing/checkout/success?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://testero.ai/pricing",
      idempotencyKey: undefined,
    });
  });
  test("enforces rate limiting", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(false);
    expect((await POST(request())).status).toBe(429);
    expect(createSession).not.toHaveBeenCalled();
  });
  test.each(["price_tampered", "price_server_pass", "price_retired"])(
    "rejects client priceId %s",
    async (priceId) => {
      expect((await POST(request({ priceId }))).status).toBe(400);
      expect(createCustomer).not.toHaveBeenCalled();
    }
  );
  test("does not modify or reject an active legacy subscription", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(from).not.toHaveBeenCalled();
  });
  test("handles Stripe API errors", async () => {
    createCustomer.mockRejectedValueOnce(new Error("Stripe API error"));
    expect((await POST(request())).status).toBe(500);
  });
  test.each([null, { idempotencyKey: "short" }, { mode: "subscription" }])(
    "validates request body %j",
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
    }
  );
  test("handles malformed JSON", async () => {
    const req = request();
    req.json = jest.fn().mockRejectedValue(new SyntaxError("invalid"));
    expect((await POST(req)).status).toBe(400);
  });
  test("fails closed when server price is not configured", async () => {
    delete process.env.STRIPE_PRICE_PMLE_PASS;
    expect((await POST(request())).status).toBe(500);
    expect(createSession).not.toHaveBeenCalled();
  });
  test("namespaces the optional body idempotency key by user and server price", async () => {
    await POST(
      request({ idempotencyKey: "request-key-123" }, { "x-idempotency-key": "untrusted-header" })
    );
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "user_123:price_server_pass:request-key-123" })
    );
  });
  test("ignores header-only idempotency keys", async () => {
    await POST(request({}, { "x-idempotency-key": "untrusted-header" }));
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: undefined })
    );
  });
});
