import type { DiagnosticResult } from "@/lib/diagnostic/types";
import { getDomainTier, getExamReadinessTier } from "@/lib/readiness";

export function ScoreBar({ score }: { score: number }) {
  return <div className="space-y-3 pt-2">
    <div role="progressbar" aria-label="Readiness score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-valuetext={`${score} out of 100. Building starts at 40, Ready at 70, Strong at 85.`} className="relative h-2 rounded bg-input">
      <div className="h-full rounded bg-primary" style={{ width: `${score}%` }} />
      {[40, 70, 85].map(tick => <span key={tick} aria-hidden="true" className="absolute -top-1 h-4 w-px bg-muted-foreground" style={{ left: `${tick}%` }} />)}
    </div>
    <div aria-hidden="true" className="grid grid-cols-[40fr_30fr_15fr_15fr] text-xs leading-snug text-muted-foreground">
      <span>Low<br />0</span><span>Building<br />40</span><span>Ready<br />70</span><span>Strong<br />85</span>
    </div>
  </div>;
}

export function ScoreReport({ score, correctAnswers, totalQuestions }: Pick<DiagnosticResult, "score" | "correctAnswers" | "totalQuestions">) {
  const tier = getExamReadinessTier(score);
  return <section aria-label="Overall score" className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-7">
    <h2 className="text-sm font-medium text-muted-foreground">Overall score</h2>
    <div className="flex flex-wrap items-baseline gap-3">
      <p className="text-[52px] font-semibold leading-none">{score}<span className="ml-3 text-base font-normal text-muted-foreground">/ 100</span></p>
      <span className="ml-auto rounded border border-input px-2 py-0.5 text-sm font-medium">Tier: {tier.label}</span>
    </div>
    <p className="text-sm text-muted-foreground"><span>{correctAnswers} of {totalQuestions} correct</span>{score < 70 && <> · {70 - score} points to Ready</>}</p>
    <ScoreBar score={score} />
  </section>;
}

export function DomainStatus({ percentage }: { percentage: number }) {
  const tier = getDomainTier(percentage).id;
  const statuses = {
    critical: { label: "Focus area", className: "bg-focus-area-background text-focus-area" },
    moderate: { label: "Developing", className: "bg-muted text-body" },
    strong: { label: "Solid", className: "bg-solid-background text-solid" },
  };
  const status = statuses[tier];
  return <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium sm:text-sm ${status.className}`}>{status.label}</span>;
}

export function DomainScores({ domains, sample = false }: { domains: DiagnosticResult["domainBreakdown"]; sample?: boolean }) {
  const ordered = [...domains].sort((a, b) => a.percentage - b.percentage);
  return <table className="w-full table-fixed border-collapse text-sm sm:text-base">
    <caption className="sr-only">Domain scores, weakest first</caption>
    <thead className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <tr><th scope="col" className="pb-3 font-medium">Domain</th>{!sample && <th scope="col" className="hidden w-20 pb-3 font-medium sm:table-cell">Correct</th>}<th scope="col" className="w-14 pb-3 text-right font-medium sm:w-20">Score</th><th scope="col" className="w-24 pb-3 pl-2 font-medium sm:w-28 sm:pl-4">Status</th></tr>
    </thead>
    <tbody>{ordered.map(domain => <tr key={domain.domainCode} className="border-t border-border">
      <th scope="row" className="py-3 pr-2 text-left align-top font-normal leading-relaxed">{domain.domainName}{!sample && <span className="mt-1 block text-xs text-muted-foreground sm:hidden">{domain.correct} of {domain.total} correct</span>}</th>
      {!sample && <td className="hidden py-3 align-top text-sm text-muted-foreground sm:table-cell">{domain.correct} of {domain.total}</td>}
      <td className="py-3 text-right align-top font-semibold">{domain.percentage}%</td><td className="py-3 pl-2 align-top sm:pl-4"><DomainStatus percentage={domain.percentage} /></td>
    </tr>)}</tbody>
  </table>;
}
