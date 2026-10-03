import { redirect } from "next/navigation";
import BetaPage from "@/app/beta/page";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

// 8d8d93c retired beta onboarding in favor of standard product flows.
describe("Retired Beta Page", () => {
  beforeEach(() => jest.clearAllMocks());

  it("redirects legacy beta visitors to pricing", () => {
    BetaPage();

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/pricing");
  });

  it("propagates the Next.js redirect signal", () => {
    const redirectSignal = new Error("NEXT_REDIRECT");
    jest.mocked(redirect).mockImplementationOnce(() => {
      throw redirectSignal;
    });

    expect(() => BetaPage()).toThrow(redirectSignal);
  });
});
