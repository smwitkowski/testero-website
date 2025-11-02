export type BillingEnforcement = "off" | "active_required";

/**
 * Get billing enforcement mode from environment variable
 * Defaults to 'off' if not set or invalid value
 */
export function getBillingEnforcement(): BillingEnforcement {
  const value = process.env.BILLING_ENFORCEMENT;
  if (value === "active_required") {
    return "active_required";
  }
  return "off";
}

