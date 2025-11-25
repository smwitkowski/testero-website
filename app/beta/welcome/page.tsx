/**
 * Beta welcome page redirect - routes have been retired in favor of standard product flows.
 * Redirects to diagnostic start page.
 */
import { redirect } from 'next/navigation';

export default function BetaWelcomePage() {
  redirect('/diagnostic');
}
