import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { DEFAULT_DESCRIPTION, pageMetadata, SITE_ORIGIN } from "@/lib/seo";
import { SiteHeader } from "@/components/site-header";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

const ibmPlexSans = localFont({
  src: [
    { path: "./fonts/IBMPlexSans-Regular-Latin1.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSans-Medium-Latin1.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexSans-SemiBold-Latin1.woff2", weight: "600", style: "normal" },
    { path: "./fonts/IBMPlexSans-Italic-Latin1.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  ...pageMetadata("PMLE readiness diagnostic", DEFAULT_DESCRIPTION, "/"),
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: "PMLE readiness diagnostic | Testero", template: "%s | Testero" },
  // Do not inherit a root canonical on private pages. Public pages set their own.
  alternates: undefined,
  icons: { icon: "/logo.svg" },
};

// Lets env(safe-area-inset-bottom) work for the pinned diagnostic action bar on notched phones.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${ibmPlexSans.variable} min-h-screen font-sans antialiased`}>
        <AnalyticsProvider>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-card focus:p-4">Skip to content</a>
          <SiteHeader />
          <main id="main-content" className="mx-auto min-h-[calc(100vh-12rem)] max-w-[1120px] px-5 py-10 sm:px-8 sm:py-16">{children}</main>
          <SiteChrome><SiteFooter /></SiteChrome>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
