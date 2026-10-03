import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "PMLE Pass pricing" };
export default function PricingPage() {
  return (
    <PhasePlaceholder phase={3} title="PMLE Pass" description="Planned: US $39 one-time for 90 days of PMLE access. No auto-renew. 7-day refund. Purchases are not available in this preview."
      primary={{ href: "/signup", label: "Preview pass flow" }} links={[{ href: "/diagnostic", label: "Start free diagnostic" }]}>
      <div className="space-y-3 border-y border-border py-5">
        <h2 className="text-xl font-semibold">Planned access</h2>
        <p className="leading-relaxed text-muted-foreground">PMLE Pass will include explanations and unlimited practice. The diagnostic is free now. Free accounts and 5 practice questions per week are coming in Phase 2.</p>
      </div>
    </PhasePlaceholder>
  );
}
