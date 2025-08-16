import {
  parseCampaignParams,
  CampaignParams,
  storeCampaignAttribution,
  getCampaignAttribution,
  clearCampaignAttribution,
  addCampaignAttributionToEvent,
} from "@/lib/analytics/campaign-attribution";

describe("UTM Parameter Parsing", () => {
  it("should extract campaign parameters from URL", () => {
    const url =
      "https://testero.com/beta/welcome?utm_source=loops&utm_campaign=beta_launch_2025&campaign_id=beta_75_test&variant=A";
    const result = parseCampaignParams(url);

    expect(result).toEqual({
      utm_source: "loops",
      utm_campaign: "beta_launch_2025",
      campaign_id: "beta_75_test",
      variant: "A",
    });
  });

  it("should handle missing parameters gracefully", () => {
    const url = "https://testero.com/beta/welcome";
    const result = parseCampaignParams(url);

    expect(result).toEqual({
      utm_source: undefined,
      utm_campaign: undefined,
      campaign_id: undefined,
      variant: undefined,
    });
  });

  it("should handle URLs with only some parameters", () => {
    const url = "https://testero.com/beta/welcome?utm_source=loops&variant=B";
    const result = parseCampaignParams(url);

    expect(result).toEqual({
      utm_source: "loops",
      utm_campaign: undefined,
      campaign_id: undefined,
      variant: "B",
    });
  });

  it("should handle invalid URLs gracefully", () => {
    const invalidUrl = "not-a-valid-url";
    const result = parseCampaignParams(invalidUrl);

    expect(result).toEqual({
      utm_source: undefined,
      utm_campaign: undefined,
      campaign_id: undefined,
      variant: undefined,
    });
  });

  it("should extract email parameter for attribution", () => {
    const url =
      "https://testero.com/beta/welcome?utm_source=loops&campaign_id=beta_75_test&email=user%40example.com";
    const result = parseCampaignParams(url);

    expect(result).toEqual({
      utm_source: "loops",
      utm_campaign: undefined,
      campaign_id: "beta_75_test",
      variant: undefined,
      email: "user@example.com",
    });
  });

  it("should only accept valid variant values", () => {
    const urlWithInvalidVariant = "https://testero.com/beta/welcome?variant=invalid";
    const result = parseCampaignParams(urlWithInvalidVariant);

    expect(result.variant).toBeUndefined();
  });

  it("should accept valid variant values A and B", () => {
    const urlA = "https://testero.com/beta/welcome?variant=A";
    const urlB = "https://testero.com/beta/welcome?variant=B";

    expect(parseCampaignParams(urlA).variant).toBe("A");
    expect(parseCampaignParams(urlB).variant).toBe("B");
  });
});

describe("Campaign Attribution Storage", () => {
  // Mock sessionStorage for testing
  let mockSessionStorage: { [key: string]: string } = {};

  beforeEach(() => {
    mockSessionStorage = {};
    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: jest.fn((key: string) => mockSessionStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockSessionStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockSessionStorage[key];
        }),
        clear: jest.fn(() => {
          mockSessionStorage = {};
        }),
      },
      writable: true,
    });
  });

  it("should store campaign attribution in session storage", () => {
    const attribution: CampaignParams = {
      campaign_id: "beta_75_test",
      variant: "A",
      utm_source: "loops",
    };

    storeCampaignAttribution(attribution);
    const stored = getCampaignAttribution();

    expect(stored).toEqual(attribution);
  });

  it("should persist attribution across function calls", () => {
    const attribution: CampaignParams = {
      campaign_id: "beta_75_test",
      variant: "B",
      utm_campaign: "beta_launch_2025",
    };

    storeCampaignAttribution(attribution);

    // Simulate page navigation by calling getCampaignAttribution again
    const persistedAttribution = getCampaignAttribution();

    expect(persistedAttribution).toEqual(attribution);
  });

  it("should return null when no attribution is stored", () => {
    const attribution = getCampaignAttribution();
    expect(attribution).toBeNull();
  });

  it("should handle malformed data in sessionStorage gracefully", () => {
    // Manually set invalid JSON in sessionStorage
    mockSessionStorage["testero_campaign_attribution"] = "invalid-json";

    const attribution = getCampaignAttribution();
    expect(attribution).toBeNull();
  });

  it("should clear campaign attribution", () => {
    const attribution: CampaignParams = {
      campaign_id: "test_campaign",
      variant: "A",
    };

    storeCampaignAttribution(attribution);
    expect(getCampaignAttribution()).toEqual(attribution);

    clearCampaignAttribution();
    expect(getCampaignAttribution()).toBeNull();
  });

  it("should merge new attribution with existing attribution", () => {
    const initialAttribution: CampaignParams = {
      utm_source: "loops",
      campaign_id: "beta_75_test",
    };

    const additionalAttribution: CampaignParams = {
      variant: "A",
      utm_campaign: "beta_launch_2025",
    };

    storeCampaignAttribution(initialAttribution);
    storeCampaignAttribution(additionalAttribution, true); // merge flag

    const merged = getCampaignAttribution();
    expect(merged).toEqual({
      utm_source: "loops",
      campaign_id: "beta_75_test",
      variant: "A",
      utm_campaign: "beta_launch_2025",
    });
  });
});

describe("Campaign Attribution Event Enhancement", () => {
  let mockSessionStorage: { [key: string]: string } = {};

  beforeEach(() => {
    mockSessionStorage = {};
    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: jest.fn((key: string) => mockSessionStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockSessionStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockSessionStorage[key];
        }),
      },
      writable: true,
    });
  });

  it("should add campaign attribution to analytics events", () => {
    // Store attribution first
    const attribution: CampaignParams = {
      campaign_id: "beta_75_test",
      variant: "A",
      utm_source: "loops",
    };
    storeCampaignAttribution(attribution);

    // Test event without campaign data
    const baseEvent = {
      user_id: "user_123",
      action: "diagnostic_started",
    };

    const enhancedEvent = addCampaignAttributionToEvent(baseEvent);

    expect(enhancedEvent).toEqual({
      user_id: "user_123",
      action: "diagnostic_started",
      campaign_id: "beta_75_test",
      variant: "A",
      utm_source: "loops",
    });
  });

  it("should not override existing campaign data in events", () => {
    const attribution: CampaignParams = {
      campaign_id: "stored_campaign",
      variant: "A",
    };
    storeCampaignAttribution(attribution);

    const eventWithExistingData = {
      user_id: "user_123",
      campaign_id: "event_campaign", // This should not be overridden
      variant: "B",
    };

    const result = addCampaignAttributionToEvent(eventWithExistingData);

    expect(result).toEqual({
      user_id: "user_123",
      campaign_id: "event_campaign", // Original value preserved
      variant: "B", // Original value preserved
    });
  });

  it("should return original event when no attribution is stored", () => {
    const originalEvent = {
      user_id: "user_123",
      action: "some_action",
    };

    const result = addCampaignAttributionToEvent(originalEvent);

    expect(result).toEqual(originalEvent);
  });

  it("should only add non-undefined attribution values", () => {
    const partialAttribution: CampaignParams = {
      campaign_id: "beta_75_test",
      variant: "A",
      // utm_source and utm_campaign are undefined
    };
    storeCampaignAttribution(partialAttribution);

    const baseEvent = { user_id: "user_123" };
    const enhanced = addCampaignAttributionToEvent(baseEvent);

    expect(enhanced).toEqual({
      user_id: "user_123",
      campaign_id: "beta_75_test",
      variant: "A",
      // Should not include utm_source or utm_campaign since they're undefined
    });
  });
});
