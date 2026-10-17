"use client";

import { useState } from "react";
import Link from "next/link";
import { optionLabels, type OptionLabel, type PublicSample } from "@/lib/public-samples/schema";
import { domainDisplayName } from "@/lib/constants/pmle-blueprint";

export function PublicSampleQuestion({ question, index }: { question: PublicSample; index: number }) {
  const [selected, setSelected] = useState<OptionLabel | null>(null);
  const [revealed, setRevealed] = useState(false);
  return <section className="space-y-5 border-t border-border pt-6" aria-labelledby={`sample-${question.id}`}>
    <p className="text-sm text-muted-foreground">{domainDisplayName(question.domain, question.domain)}</p>
    <fieldset disabled={revealed} className="space-y-4">
      <legend id={`sample-${question.id}`} className="mb-4 text-lg font-semibold leading-7">{index + 1}. {question.stem}</legend>
      {optionLabels.map(label => <label key={label} className="answer-option flex min-h-12 cursor-pointer gap-3 rounded-lg border border-input bg-card p-4 leading-7">
        <input type="radio" name={question.id} value={label} checked={selected === label} onChange={() => setSelected(label)} className="mt-2 shrink-0" />
        <span><strong>{label}.</strong> {question.options[label]}</span>
      </label>)}
    </fieldset>
    <button type="button" disabled={!selected || revealed} onClick={() => setRevealed(true)} aria-controls={`answer-${question.id}`} aria-expanded={revealed} className="min-h-12 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">Reveal answer and explanations</button>
    {revealed && <div id={`answer-${question.id}`} className="space-y-4 rounded-lg border border-border bg-muted p-5">
      <p role="status" className="font-semibold">{selected === question.key ? "Correct." : `You chose ${selected}.`} Answer: {question.key}.</p>
      <h2 className="text-lg font-semibold">Why each option is right or wrong</h2>
      <dl className="space-y-4">{optionLabels.map(label => <div key={label}><dt className="font-semibold">{label}. {question.options[label]}{label === question.key ? " — Correct answer" : " — Incorrect"}</dt><dd className="mt-1 leading-7 text-body">{question.rationale[label]}</dd></div>)}</dl>
      <h2 className="text-lg font-semibold">Official documentation</h2>
      <ul className="list-disc space-y-2 pl-5">{question.officialDocs.map(doc => <li key={doc.url}><a href={doc.url} className="text-primary underline">{doc.title}</a></li>)}</ul>
      <Link href="/diagnostic" className="inline-flex min-h-12 items-center py-2 font-semibold text-primary underline">Take the free 20-question diagnostic →</Link>
    </div>}
  </section>;
}
