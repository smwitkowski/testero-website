import { generateViewport } from "@/lib/seo/seo";

describe("generateViewport", () => {
  it("allows user zoom by omitting maximumScale", () => {
    const viewport = generateViewport();

    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
    expect("maximumScale" in viewport).toBe(false);
    expect(viewport.maximumScale).toBeUndefined();
  });
});
