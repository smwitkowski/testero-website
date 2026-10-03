import { redirect } from "next/navigation";
import BetaPage from "@/app/beta/page";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

// 8d8d93c removed all beta benefits, limitations, perks, and onboarding copy.
describe("Retired Beta Page Content", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns no retired marketing content when the redirect is mocked", () => {
    expect(BetaPage()).toBeUndefined();
    expect(redirect).toHaveBeenCalledWith("/pricing");
  });
});
