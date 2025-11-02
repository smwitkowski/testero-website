/**
 * Billing enforcement configuration helper
 * Checks if billing enforcement is active via environment variable
 */
export function isBillingEnforcementActive(): boolean {
  return process.env.BILLING_ENFORCEMENT === "active_required";
}

