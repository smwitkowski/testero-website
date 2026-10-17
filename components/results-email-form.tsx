"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
export function ResultsEmailForm({ sessionId }: { sessionId: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/diagnostic/${encodeURIComponent(sessionId)}/email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), consent: form.get("consent") === "on", website: form.get("website") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn't send your email. Please try again.");
      setSent(true); setMessage(data.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setPending(false); }
  }
  return <section aria-labelledby="email-results-heading" className="space-y-4 rounded-lg border border-border bg-card p-5 sm:p-7">
    <h2 id="email-results-heading" className="text-xl font-semibold">Email me my results + a 4-week plan</h2>
    <p className="text-sm text-muted-foreground">Optional: one email with your results; no newsletter. The plan assumes 4 study hours a week.</p>
    {!sent && <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-medium">Email address<input name="email" type="email" required maxLength={254} autoComplete="email" data-ph-mask className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2" /></label>
      <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="flex items-start gap-2 text-sm"><input name="consent" type="checkbox" required className="mt-1" />Send me this one results email and study plan.</label>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Email my results"}</Button>
    </form>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
