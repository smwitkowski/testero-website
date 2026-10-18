import Link from "next/link";
import { getFaqEntries } from "@/lib/content/loader";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Frequently asked questions", "Answers to common Google Cloud certification questions, with visible sources and current official guidance.", "/faq");
export default function FaqPage() {
  const entries = getFaqEntries().filter(entry => !["is-google-data-analytics-certification-worth-it", "how-long-to-complete-google-data-analytics-certification"].includes(entry.slug)).sort((a, b) => Number(b.exam === "Professional Machine Learning Engineer") - Number(a.exam === "Professional Machine Learning Engineer"));
  return <section className="certification-content space-y-8">
    <header className="space-y-3"><p className="text-sm font-medium text-primary">Certification resources</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked questions</h1><p className="max-w-2xl leading-relaxed text-muted-foreground">Answers to common Google Cloud certification questions, with visible sources and current official guidance.</p></header>
    <section aria-labelledby="product-questions" className="space-y-5"><h2 id="product-questions" className="text-2xl font-semibold">Using Testero</h2>
      <dl className="space-y-5 leading-relaxed">{[
        ["What can I do without an account, with a free account or with PMLE Pass?", "No account is needed for a 5-, 10- or 20-question diagnostic, your score and domain breakdown. A free account saves your report, adds answer review and gives you 5 practice questions a week. PMLE Pass adds full explanations and unlimited 5-question practice sessions."],
        ["Which explanations are free?", "One server-selected question from each completed diagnostic has a full free explanation, including every option. Public sample questions also include explanations. All other diagnostic and practice explanations require PMLE Pass."],
        ["How does the weekly free allowance work?", "A confirmed free account can start one 5-question practice session per week, shared across domains. Starting the session uses that week’s allowance, even if you do not finish it. An unfinished session expires after 24 hours. The week resets on Monday at 00:00 UTC."],
        ["What happens after I create an account?", "We email a confirmation link. Confirm your email to sign in and use account features. If you came from pricing, you return there to continue to checkout; creating an account does not take a payment."],
        ["When does PMLE Pass start and end?", "PMLE Pass costs $39 USD one-time. Its 90 days start when payment is confirmed, not when you first practice. Pass features end at the expiry time shown in your account. No subscription or auto-renew; your free account remains."],
      ].map(([question, answer]) => <div key={question} className="space-y-2"><dt className="font-semibold">{question}</dt><dd className="text-body">{answer}</dd></div>)}
        <div className="space-y-2"><dt className="font-semibold">How do refunds work?</dt><dd className="text-body">Request a refund within 7 days of purchase by emailing <a href="mailto:support@testero.ai" className="text-primary underline">support@testero.ai</a>. A refund ends pass access. <Link href="/terms" className="text-primary underline">Read the service and refund terms</Link>.</dd></div>
      </dl><p><Link href="/pricing" className="text-primary underline">Compare free and paid access</Link>.</p>
    </section>
    <section aria-labelledby="certification-articles" className="space-y-4"><h2 id="certification-articles" className="text-2xl font-semibold">Certification articles</h2>
    <ul className="divide-y divide-border border-y border-border">{entries.map((entry) => <li key={entry.slug} className="space-y-3 py-6"><h2 className="text-pretty text-xl font-semibold leading-snug"><Link href={entry.href} className="text-primary hover:underline">{entry.title}</Link></h2><p className="leading-relaxed text-muted-foreground">{entry.description}</p></li>)}</ul></section>
    <p className="text-sm text-muted-foreground">Our diagnostic and practice cover PMLE only.</p>
    <Link href="/diagnostic" className="inline-flex rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">Start free PMLE diagnostic</Link>
  </section>;
}
