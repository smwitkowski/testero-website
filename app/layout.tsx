import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider"; // Import AuthProvider
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import { SessionTrackingProvider } from "@/components/providers/SessionTrackingProvider";
import { Providers } from "@/components/providers/Providers";
import Script from "next/script";
import { generateMetadata, generateJsonLd, generateViewport } from "@/lib/seo";
import { ConditionalNavbar, ConditionalMainWrapper } from "@/components/layout";

// Generate default metadata for the root layout
export const metadata = generateMetadata();

// Generate viewport configuration
export const viewport = generateViewport();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: generateJsonLd(),
          }}
        />
      </head>
      <body className="bg-background text-foreground antialiased font-sans">
        <Providers>
          {/* Skip to content link for accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-black focus:outline-none"
          >
            Skip to content
          </a>
          <ErrorBoundary>
            <AuthProvider>
              <ConditionalNavbar />
              <ConditionalMainWrapper>
                <PostHogProvider>
                  <SessionTrackingProvider>{children}</SessionTrackingProvider>
                </PostHogProvider>
              </ConditionalMainWrapper>
            </AuthProvider>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
