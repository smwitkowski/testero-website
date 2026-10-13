"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return /^\/diagnostic\/[^/]+\/?$/.test(pathname) ? null : children;
}
