"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { reportReasons } from "@/lib/question-reports/schema";
export function ReportQuestion({ sessionId, itemId, kind }: { sessionId: string; itemId: string; kind: "diagnostic" | "practice" }) {
  const [open, setOpen] = useState(false);
  const reportForm = useRef<HTMLFormElement>(null);
  useEffect(() => { if (open) reportForm.current?.scrollIntoView({ block: "nearest" }); }, [open]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/question-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, itemId, kind, reason: form.get("reason"), note: form.get("note"), email: form.get("email") }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not send your report. Please try again.");
      setSent(true); setMessage("Thanks, we review every report.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not send your report. Please try again."); }
    finally { setPending(false); }
  }
  if (sent) return <p role="status" className="text-sm text-muted-foreground">{message}</p>;
  return <div className="mt-4 text-sm">
    <button type="button" className="inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4" aria-expanded={open} onClick={() => setOpen(!open)}>Report a problem with this question</button>
    {open && <form ref={reportForm} onSubmit={submit} className="mt-3 space-y-3 rounded-md border border-border p-4" aria-busy={pending}>
      <label className="block space-y-1"><span>Reason</span><select name="reason" required className="block w-full rounded-md border border-input bg-background p-2">{reportReasons.map(reason => <option key={reason} value={reason}>{reason[0].toUpperCase() + reason.slice(1)}</option>)}</select></label>
      <label className="block space-y-1"><span>Note (optional)</span><textarea name="note" maxLength={2000} className="block w-full rounded-md border border-input bg-background p-2" /></label>
      <label className="block space-y-1"><span>Email (optional, only to follow up on this report)</span><input name="email" type="email" maxLength={254} className="block w-full rounded-md border border-input bg-background p-2" /></label>
      <p className="text-muted-foreground">Only used to follow up on this report, not for marketing. Please do not include sensitive information.</p>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send report"}</Button>
      {message && <p role="alert">{message}</p>}
    </form>}
  </div>;
}
