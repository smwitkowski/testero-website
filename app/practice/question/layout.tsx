import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canUseFeature } from "@/lib/access/pmleEntitlements";
import { getPmleAccessLevelForRequest } from "@/lib/access/pmleEntitlements.server";

export default async function PracticeQuestionLayout({ children }: { children: ReactNode }) {
  let allowed = false;
  try {
    const { user, accessLevel } = await getPmleAccessLevelForRequest();
    allowed = !!user && canUseFeature(accessLevel, "PRACTICE_SESSION");
  } catch (error) {
    console.error("Paid practice access check failed:", error);
  }
  if (!allowed) redirect("/pricing?gated=1&feature=practice");
  return children;
}
