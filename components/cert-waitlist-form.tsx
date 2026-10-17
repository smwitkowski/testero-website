"use client";

import { useState, type FormEvent } from "react";

export function CertWaitlistForm({ certId, certName }: { certId: string; certName: string }) {
  const emailId = `cert-email-${certId}`;
  const websiteId = `cert-website-${certId}`;
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);
    setPending(true);
    setStatus("");
    try {
      const response = await fetch("/api/cert-waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), website: form.get("website"), cert_id: certId,
          source_path: window.location.pathname,
          utm_source: params.get("utm_source") ?? undefined, utm_medium: params.get("utm_medium") ?? undefined, utm_campaign: params.get("utm_campaign") ?? undefined }),
      });
      if (response.ok) { setJoined(true); setStatus("You're on the list"); }
      else if (response.status === 400) setStatus("Enter a valid email address.");
      else if (response.status === 429) setStatus("Too many requests. Try again in a minute.");
      else setStatus("We couldn't save your request. Please try again.");
    } catch { setStatus("We couldn't save your request. Check your connection and try again."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    {joined ? <p className="text-sm font-semibold">Launch notification for {certName}</p> : <label className="block text-sm font-semibold" htmlFor={emailId}>Get notified when the {certName} diagnostic is ready</label>}
    {!joined && <><input id={emailId} name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" className="min-h-12 w-full rounded-md border border-input bg-card px-3 text-base" />
    <div hidden aria-hidden="true"><label htmlFor={websiteId}>Website</label><input id={websiteId} name="website" tabIndex={-1} autoComplete="off" /></div>
    <button disabled={pending} className="min-h-12 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">{pending ? "Saving…" : "Notify me"}</button></>}
    <p role="status" aria-live="polite" className={`text-sm ${joined ? "text-solid" : "text-destructive"}`}>{status}</p>
    <p className="text-xs leading-relaxed text-muted-foreground">Only a launch notification for this diagnostic, not a general mailing list. No launch date is promised. <a href="/privacy" className="underline">Privacy</a></p>
  </form>;
}
