import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { LogoutButton } from "@/components/logout-button";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Account" };
export default async function AccountPage() {
  await requireUser("/account");
  return (
    <PhasePlaceholder phase={3} title="Your account" description="Your account details and verified PMLE Pass access will appear here. PMLE Pass details are not available in this preview."
      primary={{ href: "/pricing", label: "Preview PMLE Pass" }} links={[{ href: "/dashboard", label: "Back to dashboard" }]}>
      <section className="space-y-2 border-y border-border py-5"><h2 className="text-xl font-semibold">Access until</h2><p className="leading-relaxed text-muted-foreground">Your access-until date will appear after a verified PMLE Pass purchase. No access date is available in this preview.</p></section>
      <LogoutButton />
    </PhasePlaceholder>
  );
}
