"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { ToolCertification } from "@/lib/tools/data";
import { buildStudyPlan, studyPlanText, studyTime, type StudyPlan } from "@/lib/tools/study-plan";
import { trackTool } from "@/lib/analytics/client";
import { CertAction } from "./cert-action";

export function StudyPlanner({ certs }: { certs: ToolCertification[] }) {
  const [certId, setCertId] = useState("machine-learning-engineer");
  const [result, setResult] = useState<{ plan: StudyPlan; cert: ToolCertification } | null>(null);
  const [error, setError] = useState(""); const [copied, setCopied] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = certs.find(cert => cert.cert_id === certId)!;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    try {
      const plan = buildStudyPlan(selected, String(data.get("exam-date")), Number(data.get("hours")), today);
      setResult({ plan, cert: selected }); setError(""); setCopied("");
      trackTool("tool_used", "study-plan", selected.cert_id); trackTool("tool_result_viewed", "study-plan", selected.cert_id);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (error) { setError(error instanceof Error ? error.message : "Check your date and study hours."); setResult(null); }
  }
  async function copy() {
    if (!result) return;
    try { await navigator.clipboard.writeText(studyPlanText(result.plan)); setCopied("Schedule copied."); }
    catch { setCopied("Copy is unavailable. Select the schedule text below, or print this page."); }
  }
  return <div className="space-y-8">
    <form onSubmit={submit} onInvalid={() => setResult(null)} className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-8 print:hidden">
      <h2 className="text-2xl font-semibold">Build your schedule</h2>
      <div className="space-y-2"><label htmlFor="plan-cert" className="block font-semibold">Certification</label><select id="plan-cert" value={certId} onChange={event => setCertId(event.target.value)} className="min-h-12 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base">{certs.map(cert => <option key={cert.cert_id} value={cert.cert_id}>{cert.name}{cert.guide.variant === "beta" ? " (beta guide)" : ""}</option>)}</select></div>
      <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="exam-date" className="block font-semibold">Exam date</label><input id="exam-date" name="exam-date" type="date" required aria-describedby="date-help" className="min-h-12 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base" /><p id="date-help" className="text-sm text-muted-foreground">Tomorrow through 366 days from today. The exam day is not scheduled.</p></div><div className="space-y-2"><label htmlFor="plan-hours" className="block font-semibold">Study hours per week</label><input id="plan-hours" name="hours" type="number" min="1" max="40" step="0.5" defaultValue="5" required className="min-h-12 w-full rounded-md border border-input bg-card px-3 text-base" /></div></div>
      {selected.guide.variant === "beta" && <p className="text-sm text-focus-area">This uses the beta guide. Beta registration is closed; this is not a booking tool. Check Google for availability and the GA guide.</p>}
      <p role="alert" className="text-sm text-destructive">{error}</p><button className="min-h-12 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover">Create study plan</button>
    </form>
    {result && <section className="space-y-6 rounded-lg border border-border bg-card p-5 sm:p-8 print:border-0 print:p-0" aria-labelledby="plan-result">
      <header className="space-y-3"><h2 id="plan-result" tabIndex={-1} ref={heading} className="text-2xl font-semibold">{result.cert.name} study plan</h2>{result.plan.beta && <p className="text-sm font-semibold text-focus-area">Beta guide only. Beta registration is closed; check Google for GA availability and its guide. Separate required labs are not scheduled.</p>}<p className="text-body">Exam: {result.plan.examDate} · {result.plan.hoursPerWeek} hours/week · {studyTime(result.plan.totalMinutes)} total</p><p className="text-sm leading-relaxed text-body">{result.plan.weighted ? "Time follows the official guide’s relative section weights." : "No complete section weights are available. Study time is split evenly across the included sections."} Partial weeks are prorated.</p><a href={result.cert.guide.url} className="inline-block py-2 text-primary underline">Official {result.cert.guide.variant} exam guide</a></header>
      <div className="flex flex-wrap gap-4 print:hidden"><button onClick={copy} className="min-h-12 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary-hover">Copy schedule as text</button><button onClick={() => window.print()} className="min-h-12 px-3 text-primary underline">Print schedule</button></div><p role="status" className="text-sm text-body print:hidden">{copied}</p>
      <ol className="divide-y divide-border border-y border-border">{result.plan.weeks.map(week => <li key={week.number} className="break-inside-avoid space-y-3 py-5"><h3 className="font-semibold">{Date.parse(week.end) - Date.parse(week.start) > 6 * 86_400_000 ? "Study period" : "Week"} {week.number} · {week.start} – {week.end} <span className="font-normal text-body">({studyTime(week.minutes)})</span></h3><ul className="space-y-2">{week.tasks.map(task => <li key={task.sectionId} className="grid grid-cols-[1fr_auto] gap-5 text-body"><span>{task.title}</span><span className="text-sm font-semibold">{studyTime(task.minutes)}</span></li>)}</ul><p className="text-sm text-muted-foreground">Read the objectives, try a hands-on task, then note what you need to revisit.</p></li>)}</ol>
      <details className="space-y-3"><summary className="cursor-pointer py-2 font-semibold">How the time calculation works</summary><p className="text-sm text-body">{result.plan.weighted ? `Official weights total ${result.plan.totalWeight}%. They are treated as relative shares, not changed to new exam percentages.` : "Included sections receive equal shares."} Minutes are rounded while preserving the total. A final single day is included in the preceding study period.</p></details>
      <details className="space-y-3"><summary className="cursor-pointer py-2 font-semibold">Section time allocation</summary><ul className="space-y-2 text-sm text-body">{result.plan.sections.map(section => <li key={section.id}>{section.title} — {section.weight_percent === null ? "weight not stated" : `${section.weight_approximate ? "~" : ""}${section.weight_percent}% official weight`}; {studyTime(section.minutes)} study time</li>)}</ul></details>
      <p className="text-sm leading-relaxed text-body">This is a time budget, not a promise of readiness. Adjust it for your background, labs and weak areas. <Link href={`/certifications/${result.cert.cert_id}`} className="text-primary underline">Review exam details and recommended experience</Link>.</p>
      <CertAction key={result.cert.cert_id} certId={result.cert.cert_id} certName={result.cert.name} />
    </section>}
  </div>;
}
