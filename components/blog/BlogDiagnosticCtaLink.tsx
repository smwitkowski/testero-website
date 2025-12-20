"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type BlogDiagnosticCtaLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function BlogDiagnosticCtaLink({ href, className, children }: BlogDiagnosticCtaLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navigationAttemptedRef = useRef(false);

  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        // Prevent double-navigation
        if (navigationAttemptedRef.current) {
          return;
        }

        // Capture event state immediately (before async operations)
        const shouldNavigate = !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey;
        const initialPathname = pathname;

        // Fallback: manually trigger navigation if Next's handler didn't run
        // Check after a short delay if navigation occurred
        setTimeout(() => {
          const currentPath = window.location.pathname;
          const stillOnSamePage = currentPath === initialPathname;

          // If still on same page and should navigate, trigger manual navigation
          if (stillOnSamePage && shouldNavigate) {
            navigationAttemptedRef.current = true;
            router.push(href);
          } else {
            // Reset ref if navigation shouldn't happen or already happened
            navigationAttemptedRef.current = false;
          }
        }, 30);
      }}
    >
      {children}
    </Link>
  );
}

