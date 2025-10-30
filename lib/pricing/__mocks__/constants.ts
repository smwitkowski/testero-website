// Manual mock for pricing constants in tests
export const SUBSCRIPTION_TIERS = [
  {
    id: "basic",
    name: "Basic",
    monthlyPriceId: "price_basic_monthly",
    annualPriceId: "price_basic_yearly",
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPriceId: "price_monthly",
    annualPriceId: "price_yearly",
  },
  {
    id: "all-access",
    name: "All-Access",
    monthlyPriceId: "price_all_monthly",
    annualPriceId: "price_all_yearly",
  },
];

export const EXAM_PACKAGES = [
  { id: "3-month", priceId: "price_exam_3month" },
  { id: "6-month", priceId: "price_exam_6month" },
  { id: "12-month", priceId: "price_exam_12month" },
];
