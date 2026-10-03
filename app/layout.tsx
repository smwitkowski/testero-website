import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://testero.ai"),
  title: { default: "PMLE readiness diagnostic | Testero", template: "%s | Testero" },
  description: "Take a free 20-question PMLE diagnostic and see your readiness and domain breakdown.",
  icons: { icon: "/favicon.ico" },
  openGraph: { images: ["/og-image.jpg"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <AnalyticsProvider>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-card focus:p-4">Skip to content</a>
          <SiteHeader />
          <main id="main-content" className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">{children}</main>
          <SiteFooter />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
