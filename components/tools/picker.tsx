"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { ToolCertification } from "@/lib/tools/data";
import { defaultAnswers, pickerOptions, recommendCertifications, pickerHash, readPickerHash, type PickerAnswers } from "@/lib/tools/picker";
import { trackTool } from "@/lib/analytics/client";
import { CertAction } from "./cert-action";

const labels: Record<keyof PickerAnswers, string> = { role: "1. Which role best describes you?", cloud: "2. How long have you used Google Cloud?", industry: "3. How much relevant industry experience do you have?", focus: "4. What do you want to focus on?", goal: "5. What is your certification goal?" };
export function CertificationPicker({ certs }: { certs: ToolCertification[] }) {
  const [answers, setAnswers] = useState<PickerAnswers>(defaultAnswers);
  const [results, setResults] = useState<ReturnType<typeof recommendCertifications>>([]);
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const restore = () => {
      const shared = readPickerHash(window.location.hash, certs);
      setResults(shared);
      if (shared.length) trackTool("tool_result_viewed", "cert-picker", shared[0].cert.cert_id);
    };
    restore(); window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, [certs]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = recommendCertifications(answers, certs);
    setResults(next); setMessage("");
    window.history.replaceState(null, "", `${window.location.pathname}${pickerHash(next.map(result => result.cert.cert_id))}`);
    trackTool("tool_used", "cert-picker", next[0]?.cert.cert_id);
    trackTool("tool_result_viewed", "cert-picker", next[0]?.cert.cert_id);
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function share() {
    try { await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${pickerHash(results.map(result => result.cert.cert_id))}`); setMessage("Result link copied."); }
    catch { setMessage("Copy the URL from your address bar to share these results."); }
  }
  return <div className="space-y-8">
    <form onSubmit={submit} className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-8">
      <h2 className="text-2xl font-semibold">Find your starting point</h2>
      <div className="grid gap-5 sm:grid-cols-2">{(Object.keys(pickerOptions) as (keyof PickerAnswers)[]).map(key => <div key={key} className="min-w-0 space-y-2"><label htmlFor={`picker-${key}`} className="block font-semibold">{labels[key]}</label><select id={`picker-${key}`} value={answers[key]} onChange={event => setAnswers({ ...answers, [key]: event.target.value })} className="min-h-12 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base">{pickerOptions[key].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>)}</div>
      <button className="min-h-12 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover">Show my matches</button>
    </form>
    {!!results.length && <section className="space-y-5" aria-labelledby="picker-result"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="picker-result" tabIndex={-1} ref={heading} className="text-2xl font-semibold">Your certification shortlist</h2><button onClick={share} className="min-h-12 px-2 text-primary underline">Copy result link</button></div><p role="status" className="text-sm text-body">{message}</p><p className="text-body">Start with the first match. The other matches are alternatives or longer-term goals, not prerequisites. Experience recommendations are guidance, not eligibility rules.</p>
      <ol className="space-y-6">{results.map(({ cert, why }, i) => <li key={cert.cert_id} className="space-y-4 border-t border-border pt-5"><h3 className="text-xl font-semibold"><Link href={`/certifications/${cert.cert_id}`} className="text-primary underline">{i + 1}. {cert.name}</Link></h3><p className="leading-7 text-body">{why}</p><a href={cert.url} className="inline-block py-2 text-sm text-primary underline">Official experience guidance</a>{cert.registration === "closed_beta_upcoming_ga" && <p className="text-sm font-semibold text-focus-area">Beta registration is closed. Check Google for general availability before planning an exam.</p>}<CertAction certId={cert.cert_id} certName={cert.name} /></li>)}</ol>
    </section>}
  </div>;
}
