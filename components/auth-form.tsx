"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/auth/redirects";
import { identifyAnalytics } from "@/lib/analytics/client";
export type AuthMode = "signup" | "login" | "forgot-password" | "reset-password";
const labels: Record<AuthMode, string> = {
  signup: "Create account", login: "Sign in", "forgot-password": "Send reset link", "reset-password": "Update password",
};
const CONFIRMATION_FAILED = "This confirmation link has expired or was already used. Sign in, or request a new confirmation email below.";
const RECOVERY_FAILED = "This reset link has expired or was already used. Request a new one below.";

/** Always answers generically; the server never reveals whether the address has an account. */
function ResendConfirmation({ email, next }: { email: string; next: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: String(new FormData(event.currentTarget).get("email") ?? ""), next }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) setError(result.error ?? "Unable to complete this request. Please try again.");
      else setMessage(result.message ?? "If an account exists, we sent a new confirmation link.");
    } catch { setError("Unable to complete this request. Please try again."); }
    finally { setPending(false); }
  }
  return <section aria-labelledby="resend-heading" className="space-y-3 rounded-md border border-border bg-muted p-4">
    <h2 id="resend-heading" className="font-semibold">Didn’t get the confirmation email?</h2>
    {message ? <p role="status">{message}</p> : <form onSubmit={submit} className="space-y-3">
      <fieldset disabled={pending} className="space-y-3">
        <div className="space-y-2"><label htmlFor="resend-email" className="block text-sm font-medium">Email address</label><input id="resend-email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={email} className="min-h-12 w-full rounded-md border border-input bg-card px-3 focus-visible:outline-2 focus-visible:outline-ring" /></div>
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Sending…" : "Resend confirmation email"}</Button>
      </fieldset>
    </form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}

export function AuthForm({ mode, next = "/dashboard", confirmationFailed = false }: { mode: AuthMode; next?: string; confirmationFailed?: boolean }) {
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(confirmationFailed ? (mode === "forgot-password" ? RECOVERY_FAILED : CONFIRMATION_FAILED) : "");
  const [message, setMessage] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(confirmationFailed ? "" : null);
  const emailRequired = mode !== "reset-password";
  const passwordRequired = mode !== "forgot-password";
  const destination = safeNext(next);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body: Record<string, string> = {};
    if (emailRequired) body.email = String(data.get("email") ?? "");
    if (passwordRequired) body.password = String(data.get("password") ?? "");
    if (mode !== "reset-password") body.next = destination;
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string; message?: string; href?: string; userId?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to complete this request. Please try again.");
        // Login failures intentionally do not distinguish unconfirmed accounts from other credentials errors.
        if (mode === "login") setConfirmationEmail(body.email);
        return;
      }
      if (mode === "login" && result.userId) identifyAnalytics(result.userId);
      if (result.href) { window.location.assign(safeNext(result.href, "/")); return; }
      setMessage(result.message ?? "Check your email for a link.");
      form.reset();
    } catch { setError("Unable to complete this request. Please try again."); }
    finally { setPending(false); }
  }
  return (
    <div className="max-w-md space-y-6">
      {message ? <div role="status" className="rounded-md border border-border bg-muted p-4 leading-relaxed">
        <h2 className="mb-2 text-xl font-semibold">Check your email</h2>
        <p>{message}</p>
        {mode === "signup" && <p className="mt-3">Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link> or <Link href="/forgot-password" className="font-medium text-primary hover:underline">reset your password</Link>.</p>}
      </div> : (
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={pending} className="space-y-5">
            {emailRequired && <div className="space-y-2"><label htmlFor="email" className="block text-sm font-medium">Email</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="min-h-12 w-full rounded-md border border-input bg-card px-3 focus-visible:outline-2 focus-visible:outline-ring" /></div>}
            {passwordRequired && <div className="space-y-2"><label htmlFor="password" className="block text-sm font-medium">{mode === "reset-password" ? "New password" : "Password"}</label><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={72} aria-describedby="password-help" className="min-h-12 w-full rounded-md border border-input bg-card px-3 focus-visible:outline-2 focus-visible:outline-ring" /><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><p id="password-help" className="text-sm text-muted-foreground">Use 8–72 characters.</p><button type="button" aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="inline-flex min-h-12 items-center text-sm font-medium text-primary">{showPassword ? "Hide password" : "Show password"}</button></div></div>}
            <Button type="submit" disabled={pending} className="w-full">{pending ? "Please wait…" : labels[mode]}</Button>
          </fieldset>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {(mode === "login" || mode === "signup") && confirmationEmail !== null && <ResendConfirmation email={confirmationEmail} next={destination} />}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-primary">
        {mode === "signup" && <Link href={`/login?next=${encodeURIComponent(destination)}`} className="hover:underline">Already have an account? Sign in</Link>}
        {mode === "login" && <><Link href={`/signup?next=${encodeURIComponent(destination)}`} className="hover:underline">Create an account</Link><Link href="/forgot-password" className="hover:underline">Forgot password?</Link></>}
        {(mode === "forgot-password" || mode === "reset-password") && <Link href="/login" className="hover:underline">Back to sign in</Link>}
      </div>
    </div>
  );
}
