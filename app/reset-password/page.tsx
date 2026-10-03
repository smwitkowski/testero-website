import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Reset password" };
export default function ResetPasswordPage() {
  return <PhasePlaceholder phase={2} title="Reset your password" description="A verified reset link will let you choose a new password here. This preview does not change any password."
    primary={{ href: "/login", label: "Preview sign in" }} links={[{ href: "/forgot-password", label: "Preview password recovery" }]} />;
}
