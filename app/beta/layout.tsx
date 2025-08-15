import type { Metadata } from "next";
import type { ReactNode } from "react";

const title = "Testero Beta - What's Included | Early Access Program";
const description = "Join the Testero Beta and get exclusive early access to our AI-powered PMLE exam preparation platform. See exactly what you'll get, our current limitations, and how to get started.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "Testero beta",
    "PMLE exam preparation",
    "Google Cloud ML Engineer",
    "beta testing",
    "early access",
    "machine learning certification",
    "beta program",
    "AI-powered learning"
  ],
  authors: [{ name: "Testero" }],
  creator: "Testero",
  publisher: "Testero",
  alternates: {
    canonical: "/beta",
  },
  openGraph: {
    title,
    description,
    type: "website",
    locale: "en_US",
    url: "https://testero.ai/beta",
    siteName: "Testero",
    images: [
      {
        url: "/images/beta-og.jpg",
        width: 1200,
        height: 630,
        alt: "Testero Beta Program - Early Access to PMLE Exam Preparation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/beta-twitter.jpg"],
    creator: "@testero",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "google-site-verification-code",
  },
};

export default function BetaLayout({ children }: { children: ReactNode }) {
  return children;
}