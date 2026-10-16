import type { ReactNode } from "react";

// Session and result URLs must never enter the shared HTML cache.
export const dynamic = "force-dynamic";

export default function DiagnosticLayout({ children }: { children: ReactNode }) {
  return children;
}
