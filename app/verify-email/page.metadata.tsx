import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Email | Testero',
  description: 'Verify your email address to activate your Testero account and access all features.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Verify Email | Testero',
    description: 'Verify your email address to activate your Testero account.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Testero Email Verification',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Verify Email | Testero',
    description: 'Verify your email address to activate your Testero account.',
    images: ['/twitter-image.jpg'],
  },
};
