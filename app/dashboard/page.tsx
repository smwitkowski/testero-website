import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Dashboard" };
export default function DashboardPage() {
  return (
    <PhasePlaceholder phase={2} title="Your study dashboard" description="Your account will bring your diagnostic and targeted practice together here. This preview shows no personal results or access status."
      primary={{ href: "/practice/preview", label: "Preview practice" }} links={[{ href: "/account", label: "Preview account" }, { href: "/diagnostic", label: "Start free diagnostic" }]}>
      <div className="space-y-5 border-y border-border py-5">
        <section className="space-y-2"><h2 className="text-xl font-semibold">Readiness</h2><p className="text-muted-foreground">Your latest diagnostic readiness will appear here.</p></section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Weakest domains</h2><p className="text-muted-foreground">Your domain breakdown will help you choose what to practice next.</p></section>
        <section className="space-y-2"><h2 className="text-xl font-semibold">Pass status</h2><p className="text-muted-foreground">Your verified PMLE Pass status will appear here when billing is available in Phase 3.</p></section>
      </div>
    </PhasePlaceholder>
  );
}
