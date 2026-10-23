import { describe, expect, it } from "vitest";
import { metadata as signup } from "@/app/signup/page";
import { metadata as login } from "@/app/login/page";
import { metadata as forgotPassword } from "@/app/forgot-password/page";
import { metadata as notFound } from "@/app/not-found";
import { DEFAULT_DESCRIPTION, SOCIAL_IMAGE } from "@/lib/seo";

// Next shallow-merges metadata: title/description alone would keep the root OG text.
describe("auth and 404 metadata override inherited landing-page previews", () => {
  it.each([
    ["signup", signup, "Create an account"],
    ["login", login, "Sign in"],
    ["forgot-password", forgotPassword, "Reset your password"],
    ["404", notFound, "Page not found"],
  ] as const)("sets specific title, description and social text for %s", (_route, metadata, title) => {
    expect(metadata.title).toBe(title);
    expect(metadata.description).toBeTruthy();
    expect(metadata.description).not.toBe(DEFAULT_DESCRIPTION);
    expect(metadata.description).not.toContain("20-question diagnostic");
    expect(metadata.openGraph).toMatchObject({ title: `${title} | Testero`, description: metadata.description,
      images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630 }] });
    expect(metadata.twitter).toMatchObject({ title: `${title} | Testero`, description: metadata.description, images: [SOCIAL_IMAGE] });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).not.toHaveProperty("url", "https://testero.ai/");
  });

  it("describes the current PMLE guide and free check without implying a fixed diagnostic length", () => {
    expect(DEFAULT_DESCRIPTION).toContain("June 2026 exam guide");
    expect(DEFAULT_DESCRIPTION).toContain("free 5-question readiness check");
    expect(DEFAULT_DESCRIPTION).not.toContain("20-question");
  });
});
