import Link from "next/link";
import { MarkdownContent } from "@/components/markdown-content";
import { getLegalDocument } from "@/lib/content/loader";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata() {
  const document = getLegalDocument("terms");
  return { ...pageMetadata("Terms of service", document.approved ? "Testero terms of service." : "Being finalized. Approved legal text is required before launch.", "/terms"), ...(document.approved ? {} : { robots: { index: false, follow: true } }) };
}
export default function TermsPage() {
  const document = getLegalDocument("terms");
  return <article className="space-y-8"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{document.title}</h1>{!document.approved && <p className="inline-block rounded-md bg-muted px-3 py-2 text-sm font-medium">Awaiting founder approval</p>}<MarkdownContent content={document.body} /><Link href="/" className="inline-block text-sm font-medium text-primary hover:underline">Back to Testero</Link></article>;
}
