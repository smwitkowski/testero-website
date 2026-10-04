import { afterEach, beforeEach, vi } from "vitest";
import { resetTestEnvironment } from "./test-environment";

// Sanitize before imports as well as each test. Never enable the Stripe fixture
// globally: individual guard tests must still reject invalid configuration.
resetTestEnvironment();
beforeEach(resetTestEnvironment);
afterEach(() => vi.unstubAllEnvs());
