import Link from "next/link";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Support",
  "Contact Testero support for account, technical, billing and refund questions. Find what to include in your email and links to our policies.",
  "/support",
);

export default function SupportPage() {
  return <article className="mx-auto max-w-3xl space-y-8">
    <header className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Support</h1>
      <p className="text-lg leading-relaxed text-muted-foreground">For account, technical, billing or refund questions, email Testero support. You do not need to sign in to contact us.</p>
      <a href="mailto:support@testero.ai" className="inline-block select-text break-all font-medium text-primary underline underline-offset-4 hover:no-underline">support@testero.ai</a>
    </header>
    <section aria-labelledby="what-to-include" className="space-y-3">
      <h2 id="what-to-include" className="text-2xl font-semibold tracking-tight">What to include</h2>
      <ul className="list-disc space-y-2 pl-6 leading-7">
        <li>A short description of your question or issue and the email address associated with your Testero account, if you have one.</li>
        <li>For technical issues: the page URL, what you expected, what happened, steps to reproduce it, and your browser and device. Include a screenshot if it helps, with personal details removed.</li>
        <li>For billing or refund questions: the purchase date and receipt or payment reference, if available, so we can identify the purchase.</li>
      </ul>
      <p className="leading-7 text-muted-foreground">Do not send passwords, sign-in codes, full payment card details or confidential exam content.</p>
    </section>
    <section aria-labelledby="response-expectations" className="space-y-3">
      <h2 id="response-expectations" className="text-2xl font-semibold tracking-tight">What to expect</h2>
      <p className="leading-7 text-muted-foreground">Response times vary by request. We do not guarantee a response or resolution time. If you need to add details, reply in the same email thread to keep the context together.</p>
    </section>
    <section aria-labelledby="support-policies" className="space-y-3">
      <h2 id="support-policies" className="text-2xl font-semibold tracking-tight">Policies</h2>
      <p className="leading-7">Read our <Link href="/terms#refunds" className="text-primary underline underline-offset-4 hover:no-underline">refund policy</Link> in the terms of service. See our <Link href="/privacy" className="text-primary underline underline-offset-4 hover:no-underline">privacy policy</Link> for how Testero handles personal information.</p>
    </section>
    <Link href="/" className="inline-block text-sm font-medium text-primary hover:underline">Back to Testero</Link>
  </article>;
}
