import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Account" };
export default function AccountPage() {
  return (
    <PhasePlaceholder phase={3} title="Your account" description="Your account details and verified PMLE Pass access will appear here. This preview does not change your account or sign you out."
      primary={{ href: "/pricing", label: "Preview PMLE Pass" }} links={[{ href: "/login", label: "Preview sign-out destination" }, { href: "/dashboard", label: "Back to dashboard preview" }]}>
      <section className="space-y-2 border-y border-border py-5"><h2 className="text-xl font-semibold">Access until</h2><p className="leading-relaxed text-muted-foreground">Your access-until date will appear after a verified PMLE Pass purchase. No access date is available in this preview.</p></section>
    </PhasePlaceholder>
  );
}
