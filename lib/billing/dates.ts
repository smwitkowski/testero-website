/** Shared by server and client components. Dates are shown in UTC to match access checks. */
export function accessDate(value: string | null): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** Whole days remaining, counting a partial day as one. */
export function daysLeft(value: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(value) - now) / 86_400_000));
}
