import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Terms" };
export default function TermsPage() {
  return <PhasePlaceholder phase={4} title="Terms" description="Being finalized. Approved terms will be published here before launch. This placeholder is not a legal agreement." />;
}
