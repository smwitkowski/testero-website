import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/seo";

export const privatePaths = [
  "/api/", "/auth/", "/account", "/dashboard", "/practice/", "/diagnostic/",
  "/checkout/", "/login", "/signup", "/forgot-password", "/reset-password",
  "/verify-email", "/admin/", "/_next/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: privatePaths },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
