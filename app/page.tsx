import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function HomePage() {
  return (
    <PhasePlaceholder phase={4} title="Know where to focus your PMLE study."
      description="Take a free 20-question diagnostic for the Google Cloud Professional Machine Learning Engineer exam. See your score, readiness tier, and all six exam domains."
      links={[{ href: "/pricing", label: "Preview PMLE Pass" }]}>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">The diagnostic is available now. The full landing page is coming in Phase 4. No account required. Study guidance, not a prediction of your exam result.</p>
    </PhasePlaceholder>
  );
}
