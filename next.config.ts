import type { NextConfig } from "next";
import { nextLegacyRedirects } from "./lib/navigation/legacy-redirects";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  env: { TESTERO_BUILD_TIME: new Date().toISOString() },
  agentRules: false,
  outputFileTracingIncludes: { "/*": ["./content/**/*"] },
  async redirects() { return nextLegacyRedirects(); },
};

export default nextConfig;
