"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) { setError("Unable to sign out. Please try again."); return; }
      // Reload to drop cached protected server-component data after cookie clearing.
      window.location.assign(new URL("/", window.location.origin).href);
    } catch { setError("Unable to sign out. Please try again."); }
    finally { setPending(false); }
  }
  return <div className="space-y-2"><Button variant="outline" onClick={logout} disabled={pending}>{pending ? "Signing out…" : "Sign out"}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
