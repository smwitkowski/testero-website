import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Create an account" };
export default function SignupPage() {
  return <PhasePlaceholder phase={2} title="Create an account" description="Email signup and verification will let you keep your diagnostic, review your answers, and start weekly free practice. This preview does not create an account."
    primary={{ href: "/dashboard", label: "Preview dashboard" }} links={[{ href: "/login", label: "Preview sign in" }, { href: "/diagnostic", label: "Start free diagnostic" }]} />;
}
