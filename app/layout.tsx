import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider"; // Import AuthProvider
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import Script from "next/script";
import { generateMetadata, generateJsonLd, generateViewport } from "@/lib/seo";
import Navbar from "@/components/marketing/navigation/navbar"; // Import the Navbar component

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="en">
      <head>
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: generateJsonLd()
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* Skip to content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-black focus:outline-none"
        >
          Skip to content
        </a>
        <AuthProvider>
          <Navbar />
          <main id="main-content" className="pt-[72px]"> {/* Add padding to main content */}
            <PostHogProvider>{children}</PostHogProvider>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
