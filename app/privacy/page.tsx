import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Privacy" };
export default function PrivacyPage() {
  return <PhasePlaceholder phase={4} title="Privacy" description="Being finalized. The approved privacy policy will be published here before launch. This placeholder is not a privacy policy." />;
}
