"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DomainScores, ScoreBar } from "@/components/readiness-report";
import { PMLE_BLUEPRINT_MAP } from "@/lib/constants/pmle-blueprint";

const previews = [
  { name: "Machine Learning Engineer", slug: "machine-learning-engineer", focus: ["ML solutions", "Model serving", "ML pipelines"] },
  { name: "Cloud Engineer", slug: "cloud-engineer", focus: ["Cloud environments", "Deployment", "Operations"] },
  { name: "Cloud Architect", slug: "cloud-architect", focus: ["Architecture", "Infrastructure", "Security"] },
  { name: "Data Engineer", slug: "data-engineer", focus: ["Data processing", "Storage", "Analytics"] },
];
const sampleDomains = [
  { domainCode: "AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES", total: 3, correct: 1, percentage: 33 },
  { domainCode: "SERVING_AND_SCALING_MODELS", total: 3, correct: 2, percentage: 67 },
  { domainCode: "COLLABORATING_TO_MANAGE_DATA_AND_MODELS", total: 4, correct: 3, percentage: 75 },
].map(domain => ({ ...domain, domainName: PMLE_BLUEPRINT_MAP[domain.domainCode].displayName }));

export function CertificationPreview() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [hovered, setHovered] = useState(false);
  const preview = previews[index];
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!playing || reducedMotion || hovered) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % previews.length), 7000);
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion, hovered]);
  function move(direction: number) {
    setPlaying(false);
    setIndex(value => (value + direction + previews.length) % previews.length);
  }
  return <section aria-label="Certification readiness previews" aria-roledescription="carousel" className="min-w-0 space-y-4" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={event => { if (!(event.target as HTMLElement).closest("[data-autoplay-control]")) setPlaying(false); }}>
    <Card variant="featured" className="min-h-[29rem] space-y-5 p-5 sm:p-7" aria-live={playing && !reducedMotion ? "off" : "polite"} aria-atomic="true">
      <p className="flex flex-wrap justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Readiness report preview</span><span>{index === 0 ? "PMLE · Live" : "Coming soon"}</span></p>
      <h2 className="text-xl font-semibold">{preview.name}</h2>
      {index === 0 ? <>
        <div className="flex flex-wrap items-baseline gap-3"><span className="text-5xl font-semibold leading-none">55</span><span className="text-muted-foreground">/ 100</span><span className="ml-auto rounded border border-input px-2 py-1 text-xs font-medium">Tier: Building</span></div>
        <ScoreBar score={55} />
        <div><div className="hidden sm:block"><DomainScores domains={sampleDomains} /></div><dl className="divide-y divide-border sm:hidden">{sampleDomains.map(domain => <div key={domain.domainCode} className="space-y-1 py-3"><dt className="text-sm leading-relaxed">{domain.domainName}</dt><dd className="text-sm font-semibold">{domain.correct} of {domain.total} correct · {domain.correct === 1 ? "Focus area" : "Developing"}</dd></div>)}</dl><p className="pt-2 text-xs text-muted-foreground">Illustrative PMLE data, not a user result. 3 of 6 domains shown.</p></div>
      </> : <>
        <p className="border-y border-border py-5 text-lg font-medium">Your next certification. A clearer study focus.</p>
        <p className="leading-relaxed text-body">This diagnostic is not available yet. Explore the official exam facts and preparation guide while we build it.</p>
        <ul className="divide-y divide-border text-sm text-body">{preview.focus.map(topic => <li key={topic} className="py-3">{topic}</li>)}</ul>
        <p className="text-xs text-muted-foreground">Concept preview only. No readiness scores or launch date are promised.</p>
      </>}
      <Link className="inline-block text-sm font-semibold text-primary underline" href={`/certifications/${preview.slug}`}>Explore this certification →</Link>
    </Card>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1"><Button variant="ghost" onClick={() => move(-1)} aria-label="Previous certification">←</Button><span className="text-sm text-muted-foreground">{index + 1} / {previews.length}</span><Button variant="ghost" onClick={() => move(1)} aria-label="Next certification">→</Button></div>
      {!reducedMotion && <Button data-autoplay-control variant="ghost" onClick={() => setPlaying(value => !value)}>{playing ? "Pause previews" : "Play previews"}</Button>}
    </div>
  </section>;
}
