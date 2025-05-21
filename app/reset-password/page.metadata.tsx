import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password | Testero',
  description: 'Create a new password for your Testero account to regain access securely.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Reset Password | Testero',
    description: 'Reset your password to securely access your Testero account.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Testero Password Reset',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reset Password | Testero',
    description: 'Reset your password to securely access your Testero account.',
    images: ['/twitter-image.jpg'],
  },
};
