import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Forgot password" };
export default function ForgotPasswordPage() {
  return <PhasePlaceholder phase={2} title="Recover your password" description="You will be able to request a password-reset email here. No email is sent from this preview."
    primary={{ href: "/reset-password", label: "Preview password reset" }} links={[{ href: "/login", label: "Back to sign in" }]} />;
}
