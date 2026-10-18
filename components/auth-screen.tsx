"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { AuthForm } from "@/components/auth-form";
import { Card } from "@/components/ui/card";

export function AuthScreen({ mode: initialMode, next, confirmationFailed }: { mode: "signup" | "login"; next: string; confirmationFailed: boolean }) {
  const [mode, setMode] = useState(initialMode);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = mode === "signup" ? 0 : 1;
  function activate(index: number) {
    setMode(index === 0 ? "signup" : "login");
    tabs.current[index]?.focus();
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = event.key === "Home" ? 0 : event.key === "End" ? 1 : ["ArrowLeft", "ArrowRight"].includes(event.key) ? 1 - activeIndex : null;
    if (index === null) return;
    event.preventDefault();
    activate(index);
  }
  return <div className="mx-auto max-w-[520px]">
    <Card className="space-y-6 p-6 sm:p-8">
      <div role="tablist" aria-label="Account" className="inline-flex max-w-full gap-1 rounded-md bg-muted p-1">
        {["Create account", "Sign in"].map((label, index) => <button key={label} ref={node => { tabs.current[index] = node; }} type="button" role="tab" id={`account-tab-${index}`} aria-selected={activeIndex === index} aria-controls="account-panel" tabIndex={activeIndex === index ? 0 : -1} onKeyDown={keyDown} onClick={() => activate(index)} className={`min-h-12 rounded px-4 text-sm font-medium ${activeIndex === index ? "border border-input bg-card text-foreground" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
      </div>
      <div id="account-panel" role="tabpanel" aria-labelledby={`account-tab-${activeIndex}`} className="space-y-6">
        <header className="space-y-2"><h1 className="text-3xl font-semibold leading-tight">{mode === "signup" ? "Save your report and start practicing" : "Sign in"}</h1><p className="leading-relaxed text-muted-foreground">{mode === "signup" ? "Free account. We’ll email a link to confirm your address." : "Continue your PMLE preparation."}</p></header>
        <AuthForm key={mode} mode={mode} next={next} confirmationFailed={confirmationFailed} />
      </div>
    {mode === "signup" && <aside aria-label="Free account includes" className="space-y-3 border-t border-border pt-6 text-sm text-body">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Your free account</h2>
      <ul className="list-disc space-y-2 pl-5"><li>Review your diagnostic answers against the correct ones</li><li>Keep your report on your dashboard</li><li>5 free practice questions a week</li></ul>
      <p className="text-sm text-muted-foreground">Testero is independent and not affiliated with Google.</p>
    </aside>}
    </Card>
  </div>;
}
