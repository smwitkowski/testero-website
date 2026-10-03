import { pageMetadata } from "@/lib/seo";
import { DiagnosticStart } from "@/components/diagnostic-start";

export const metadata = pageMetadata("Start your free PMLE diagnostic", "Answer 20 questions across six PMLE exam domains. See your readiness and study focus without an account.", "/diagnostic");
export default function DiagnosticStartPage() { return <DiagnosticStart />; }
