"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/marketing/navigation/navbar";

export const ConditionalNavbar = () => {
  const pathname = usePathname();
  
  // Hide navbar on dashboard routes (AppShell provides its own TopBar)
  if (pathname?.startsWith("/dashboard")) {
    return null;
  }
  
  return <Navbar />;
};



