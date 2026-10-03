import type { ReactNode } from "react";

// Diagnostics and quota-backed practice sessions are not paid-only routes.
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
