import { redirect } from 'next/navigation';

/**
 * Beta page redirect - routes have been retired in favor of standard product flows.
 * Redirects to pricing page for marketing information.
 */
export default function BetaPage() {
  redirect('/pricing');
}