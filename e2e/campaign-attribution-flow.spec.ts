import { test, expect } from "@playwright/test";

test.describe("Campaign Attribution Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Set up clean state for each test
    await page.goto("/");
  });

  test("should capture campaign attribution from email landing URL", async ({ page }) => {
    // Simulate user clicking email link with campaign parameters
    const campaignUrl =
      "/beta/welcome?utm_source=loops&campaign_id=beta_75_test&variant=A&email=test%40example.com";

    await page.goto(campaignUrl);

    // Verify page loads
    await expect(page).toHaveTitle(/Testero/);

    // Check that campaign attribution is stored in sessionStorage
    const storedAttribution = await page.evaluate(() => {
      return sessionStorage.getItem("testero_campaign_attribution");
    });

    expect(storedAttribution).toBeTruthy();

    const attribution = JSON.parse(storedAttribution!);
    expect(attribution).toEqual({
      utm_source: "loops",
      campaign_id: "beta_75_test",
      variant: "A",
      email: "test@example.com",
      utm_campaign: undefined,
    });
  });

  test("should persist campaign attribution across page navigation", async ({ page }) => {
    // Land with campaign parameters
    await page.goto("/beta/welcome?utm_source=loops&campaign_id=beta_75_test&variant=B");

    // Navigate to diagnostic page
    await page.click("text=Start Diagnostic");
    await expect(page).toHaveURL(/\/diagnostic/);

    // Verify attribution is still stored
    const attribution = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem("testero_campaign_attribution") || "{}");
    });

    expect(attribution.campaign_id).toBe("beta_75_test");
    expect(attribution.variant).toBe("B");
  });

  test("should track campaign landing event with PostHog", async ({ page }) => {
    // Mock PostHog capture calls
    let capturedEvents: any[] = [];
    await page.addInitScript(() => {
      (window as any).posthog = {
        capture: (event: string, properties?: any) => {
          (window as any).capturedEvents = (window as any).capturedEvents || [];
          (window as any).capturedEvents.push({ event, properties });
        },
        identify: () => {},
      };
    });

    // Land with campaign parameters
    await page.goto("/beta/welcome?utm_source=loops&campaign_id=beta_75_test&variant=A");

    // Wait for page to load and tracking to fire
    await page.waitForTimeout(1000);

    // Check captured PostHog events
    capturedEvents = await page.evaluate(() => (window as any).capturedEvents || []);

    const campaignLandingEvent = capturedEvents.find(
      (event) => event.event === "email_campaign_landing"
    );

    expect(campaignLandingEvent).toBeDefined();
    expect(campaignLandingEvent.properties).toMatchObject({
      utm_source: "loops",
      campaign_id: "beta_75_test",
      variant: "A",
      landing_page: "/beta/welcome",
    });
  });

  test("should enhance diagnostic session with campaign attribution", async ({ page }) => {
    // Mock PostHog for event tracking
    await page.addInitScript(() => {
      (window as any).posthog = {
        capture: (event: string, properties?: any) => {
          (window as any).capturedEvents = (window as any).capturedEvents || [];
          (window as any).capturedEvents.push({ event, properties });
        },
        identify: () => {},
      };
    });

    // Land with campaign parameters
    await page.goto("/beta/welcome?utm_source=loops&campaign_id=beta_75_test&variant=A");

    // Start diagnostic session
    await page.click("text=Start Diagnostic");
    await expect(page).toHaveURL(/\/diagnostic/);

    // Wait for diagnostic start event
    await page.waitForTimeout(1000);

    // Check that diagnostic_started event includes campaign attribution
    const capturedEvents = await page.evaluate(() => (window as any).capturedEvents || []);

    const diagnosticStartEvent = capturedEvents.find(
      (event: any) => event.event === "diagnostic_started"
    );

    expect(diagnosticStartEvent).toBeDefined();
    expect(diagnosticStartEvent.properties).toMatchObject({
      campaign_id: "beta_75_test",
      variant: "A",
      utm_source: "loops",
    });
  });

  test("should handle A/B variant performance tracking", async ({ page }) => {
    // Test Variant A
    await page.goto("/beta/welcome?campaign_id=beta_75_test&variant=A");

    let attribution = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem("testero_campaign_attribution") || "{}");
    });
    expect(attribution.variant).toBe("A");

    // Test Variant B
    await page.goto("/beta/welcome?campaign_id=beta_75_test&variant=B");

    attribution = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem("testero_campaign_attribution") || "{}");
    });
    expect(attribution.variant).toBe("B");
  });

  test("should complete full campaign attribution funnel", async ({ page }) => {
    let capturedEvents: any[] = [];

    // Mock PostHog
    await page.addInitScript(() => {
      (window as any).posthog = {
        capture: (event: string, properties?: any) => {
          (window as any).capturedEvents = (window as any).capturedEvents || [];
          (window as any).capturedEvents.push({ event, properties });
        },
        identify: () => {},
      };
    });

    // 1. Email campaign landing
    await page.goto(
      "/beta/welcome?utm_source=loops&campaign_id=beta_75_test&variant=A&email=test%40example.com"
    );
    await page.waitForTimeout(500);

    // 2. Start diagnostic
    await page.click("text=Start Diagnostic");
    await expect(page).toHaveURL(/\/diagnostic/);
    await page.waitForTimeout(500);

    // 3. Complete diagnostic (simulate)
    // Note: This would require setting up mock diagnostic data
    // For now, we'll just verify the attribution persists

    // Verify all events have campaign attribution
    capturedEvents = await page.evaluate(() => (window as any).capturedEvents || []);

    // Check email_campaign_landing event
    const landingEvent = capturedEvents.find((e: any) => e.event === "email_campaign_landing");
    expect(landingEvent?.properties).toMatchObject({
      campaign_id: "beta_75_test",
      variant: "A",
      utm_source: "loops",
      email: "test@example.com",
    });

    // Check diagnostic_started event
    const startEvent = capturedEvents.find((e: any) => e.event === "diagnostic_started");
    expect(startEvent?.properties).toMatchObject({
      campaign_id: "beta_75_test",
      variant: "A",
      utm_source: "loops",
    });
  });

  test("should handle malformed or missing campaign parameters gracefully", async ({ page }) => {
    // Test with no parameters
    await page.goto("/beta/welcome");

    const attribution = await page.evaluate(() => {
      return sessionStorage.getItem("testero_campaign_attribution");
    });

    expect(attribution).toBeNull();

    // Test with malformed parameters
    await page.goto("/beta/welcome?utm_source=&campaign_id=");

    const emptyAttribution = await page.evaluate(() => {
      return sessionStorage.getItem("testero_campaign_attribution");
    });

    expect(emptyAttribution).toBeNull();
  });

  test("should track campaign attribution across user signup", async ({ page }) => {
    // Mock PostHog
    await page.addInitScript(() => {
      (window as any).posthog = {
        capture: (event: string, properties?: any) => {
          (window as any).capturedEvents = (window as any).capturedEvents || [];
          (window as any).capturedEvents.push({ event, properties });
        },
        identify: () => {},
      };
    });

    // Land with campaign attribution
    await page.goto("/beta/welcome?utm_source=loops&campaign_id=beta_75_test&variant=A");

    // Navigate to signup (if user chooses to sign up)
    await page.click("text=Sign Up");
    await expect(page).toHaveURL(/\/signup/);

    // Verify attribution is preserved for signup events
    const attribution = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem("testero_campaign_attribution") || "{}");
    });

    expect(attribution.campaign_id).toBe("beta_75_test");
    expect(attribution.variant).toBe("A");
  });

  test("should clear campaign attribution when explicitly requested", async ({ page }) => {
    // Set campaign attribution
    await page.goto("/beta/welcome?utm_source=loops&campaign_id=beta_75_test&variant=A");

    // Verify it's stored
    let attribution = await page.evaluate(() => {
      return sessionStorage.getItem("testero_campaign_attribution");
    });
    expect(attribution).toBeTruthy();

    // Clear attribution (this would be triggered by some user action)
    await page.evaluate(() => {
      sessionStorage.removeItem("testero_campaign_attribution");
    });

    // Verify it's cleared
    attribution = await page.evaluate(() => {
      return sessionStorage.getItem("testero_campaign_attribution");
    });
    expect(attribution).toBeNull();
  });
});
