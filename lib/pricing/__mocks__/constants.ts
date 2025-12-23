// Manual mock for pricing constants in tests
export const SUBSCRIPTION_TIERS = [
  {
    id: "basic",
    name: "PMLE Readiness",
    monthlyPriceId: "price_basic_monthly",
    threeMonthPriceId: "price_basic_3month",
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPriceId: "price_monthly",
    threeMonthPriceId: "price_3month",
    isHidden: true,
  },
  {
    id: "all-access",
    name: "All-Access",
    monthlyPriceId: "price_all_monthly",
    threeMonthPriceId: "price_all_3month",
    isHidden: true,
  },
];

export const EXAM_PACKAGES = [
  { id: "3-month", priceId: "price_exam_3month" },
  { id: "6-month", priceId: "price_exam_6month" },
  { id: "12-month", priceId: "price_exam_12month" },
];
