import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Checkout confirmation preview" };
export default function CheckoutSuccessPage() {
  return <PhasePlaceholder phase={3} title="Checkout confirmation" description="Verified checkout status and your PMLE Pass details will appear here. Opening this preview does not mean a payment succeeded or access was granted."
    primary={{ href: "/account", label: "Preview account" }} links={[{ href: "/pricing", label: "Back to pricing preview" }]} />;
}
