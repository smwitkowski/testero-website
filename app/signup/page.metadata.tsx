import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up | Testero',
  description: 'Create a new account on Testero to access personalized practice tests and track your progress.',
  openGraph: {
    title: 'Sign Up for Testero',
    description: 'Create a new account to access personalized practice tests and track your progress on Testero.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Testero Sign Up',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sign Up for Testero',
    description: 'Create a new account to access personalized practice tests and track your progress.',
    images: ['/twitter-image.jpg'],
  },
};
