"use client";
export function PrintCheatSheet() {
  return <button type="button" onClick={() => window.print()} className="inline-flex min-h-12 items-center rounded-lg border border-border bg-card px-5 py-3 font-semibold">Print / save PDF</button>;
}
