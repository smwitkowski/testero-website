"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/auth/redirects";
export type AuthMode = "signup" | "login" | "forgot-password" | "reset-password";
const labels: Record<AuthMode, string> = {
  signup: "Create account", login: "Sign in", "forgot-password": "Send reset link", "reset-password": "Update password",
};
export function AuthForm({ mode, next = "/dashboard", confirmationFailed = false }: { mode: AuthMode; next?: string; confirmationFailed?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(confirmationFailed ? "Unable to confirm this link. Please sign in or request a new link." : "");
  const [message, setMessage] = useState("");
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
      const result = await response.json() as { error?: string; message?: string; href?: string };
      if (!response.ok) { setError(result.error ?? "Unable to complete this request. Please try again."); return; }
      if (result.href) { window.location.assign(safeNext(result.href, "/")); return; }
      setMessage(result.message ?? "Check your email for a link.");
      form.reset();
    } catch { setError("Unable to complete this request. Please try again."); }
    finally { setPending(false); }
  }
  return (
    <div className="max-w-md space-y-6">
      {message ? <div role="status" className="rounded-md border border-border bg-muted p-4 leading-relaxed"><h2 className="mb-2 text-xl font-semibold">Check your email</h2>{message}</div> : (
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={pending} className="space-y-5">
            {emailRequired && <div className="space-y-2"><label htmlFor="email" className="block text-sm font-medium">Email</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="min-h-11 w-full rounded-md border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring" /></div>}
            {passwordRequired && <div className="space-y-2"><label htmlFor="password" className="block text-sm font-medium">{mode === "reset-password" ? "New password" : "Password"}</label><input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={72} aria-describedby="password-help" className="min-h-11 w-full rounded-md border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring" /><p id="password-help" className="text-sm text-muted-foreground">Use 8–72 characters.</p></div>}
            <Button type="submit" disabled={pending}>{pending ? "Please wait…" : labels[mode]}</Button>
          </fieldset>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-primary">
        {mode === "signup" && <Link href={`/login?next=${encodeURIComponent(destination)}`} className="hover:underline">Already have an account? Sign in</Link>}
        {mode === "login" && <><Link href={`/signup?next=${encodeURIComponent(destination)}`} className="hover:underline">Create an account</Link><Link href="/forgot-password" className="hover:underline">Forgot password?</Link></>}
        {(mode === "forgot-password" || mode === "reset-password") && <Link href="/login" className="hover:underline">Back to sign in</Link>}
      </div>
    </div>
  );
}
