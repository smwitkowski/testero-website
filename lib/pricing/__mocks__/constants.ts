// Use real public copy without recursively resolving this manual mock.
const actual = jest.requireActual<typeof import("../constants")>("../constants");
export const PMLE_PASS = actual.PMLE_PASS;
export const PMLE_PASS_FEATURES = actual.PMLE_PASS_FEATURES;
export const VALUE_PROPS = actual.VALUE_PROPS;
export const FEATURE_COMPARISON = actual.FEATURE_COMPARISON;
export const PRICING_FAQ = actual.PRICING_FAQ;
export const PRICING_TESTIMONIALS = actual.PRICING_TESTIMONIALS;
export type { PmlePass } from "../constants";
