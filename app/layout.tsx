import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

export const metadata: Metadata = {
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
          <header className="border-b border-border bg-card">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
              <Link href="/" className="flex items-center gap-2 text-lg font-semibold" aria-label="Testero home">
                <Image src="/logo.svg" alt="" width={32} height={30} priority />
                Testero
              </Link>
              <span className="text-sm text-muted-foreground">PMLE diagnostic</span>
            </div>
          </header>
          <main id="main-content" className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">{children}</main>
          <footer className="mx-auto max-w-3xl px-5 pb-8 text-sm leading-relaxed text-muted-foreground sm:px-8">
            Independent exam preparation. Not affiliated with or endorsed by Google.
          </footer>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
