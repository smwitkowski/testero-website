import type { NextConfig } from "next";
import { nextLegacyRedirects } from "./lib/navigation/legacy-redirects";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  expireTime: 86400,
  env: { TESTERO_BUILD_TIME: new Date().toISOString() },
  agentRules: false,
  outputFileTracingIncludes: { "/*": ["./content/**/*", "./content-pipeline/certs/*.json"] },
  async headers() {
    return ["/api/:path*", "/auth/:path*", "/account/:path*", "/dashboard/:path*", "/practice/:path*", "/diagnostic/:path*", "/checkout/:path*", "/results/:path*", "/login", "/signup", "/forgot-password", "/reset-password"].map(source => ({
      source, headers: [{ key: "Cache-Control", value: "private, no-store" }],
    }));
  },
  async redirects() { return nextLegacyRedirects(); },
};

export default nextConfig;
