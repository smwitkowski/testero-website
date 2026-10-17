import { chatgptPracticeUrl } from "@/lib/chatgpt-cta";

export function ChatgptCta() {
  const href = chatgptPracticeUrl(process.env.NEXT_PUBLIC_CHATGPT_CTA_ENABLED, process.env.NEXT_PUBLIC_CHATGPT_CTA_URL);
  if (!href) return null;
  return <section aria-label="Practice in ChatGPT" className="space-y-3 rounded-lg border border-border p-5">
    <h2 className="text-lg font-semibold">Practice PMLE questions in ChatGPT</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">Get started with a few PMLE demo questions, one at a time in your chat.</p>
    <a href={href} className="inline-flex min-h-11 items-center rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Practice in ChatGPT</a>
  </section>;
}
