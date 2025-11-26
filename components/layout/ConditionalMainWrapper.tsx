"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const ConditionalMainWrapper = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  
  // Dashboard routes have their own TopBar (56px), marketing routes use Navbar (72px)
  const isDashboardRoute = pathname?.startsWith("/dashboard");
  
  return (
    <main 
      id="main-content" 
      className={cn(
        !isDashboardRoute && "pt-18" // Only apply padding for non-dashboard routes (72px = 18 * 4px)
      )}
    >
      {children}
    </main>
  );
};
