import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Sign in" };
export default function LoginPage() {
  return <PhasePlaceholder phase={2} title="Sign in" description="Email and password sign-in will connect you to your saved readiness and practice. This preview does not sign you in."
    primary={{ href: "/dashboard", label: "Preview dashboard" }} links={[{ href: "/signup", label: "Preview signup" }, { href: "/forgot-password", label: "Preview password recovery" }]} />;
}
