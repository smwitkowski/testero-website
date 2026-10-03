/** Compatibility exports. Paid access has one implementation and no TTL cache. */
export {
  getPaidAccess,
  isSubscriber,
  clearSubscriberCache,
  clearAllSubscriberCache,
} from "@/lib/billing/paid-access";
export type { PaidAccess, PmlePass } from "@/lib/billing/paid-access";
