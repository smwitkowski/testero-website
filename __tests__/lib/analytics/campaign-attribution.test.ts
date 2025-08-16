import { parseCampaignParams, CampaignParams } from "@/lib/analytics/campaign-attribution";

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
