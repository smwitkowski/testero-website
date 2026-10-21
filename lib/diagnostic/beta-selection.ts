import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { betaDiagnosticMetadata, type BetaDiagnosticCertId } from "@/lib/diagnostic/beta";
import { hasValidAnswers, pickPreferred, type CanonicalAnswer, type SelectionResult } from "@/lib/diagnostic/pmle-selection";
import { shuffleArray } from "@/lib/questions/answer-order";

type Section = { id: string; weight_percent: number | null };
/** Largest remainder rounding, capped by stock; redistribute gaps without duplicates. */
export function calculateBetaDomainTargets(total: number, sections: readonly Section[], availability: ReadonlyMap<string, number>): Map<string, number> {
  if (!Number.isInteger(total) || total < 0) throw new Error("Invalid question count");
  const weight = sections.reduce((sum, section) => sum + (section.weight_percent ?? 0), 0);
  if (weight <= 0) throw new Error("Missing guide weights");
  const targets = new Map(sections.map(section => [section.id, Math.min(Math.floor(total * (section.weight_percent ?? 0) / weight), availability.get(section.id) ?? 0)]));
  let allocated = [...targets.values()].reduce((sum, value) => sum + value, 0);
  while (allocated < total) {
    const available = sections.filter(section => (targets.get(section.id) ?? 0) < (availability.get(section.id) ?? 0));
    if (!available.length) break;
    // Largest remaining deficit from the weighted quota. Stable guide order breaks ties.
    available.sort((a, b) => (total * (b.weight_percent ?? 0) / weight - targets.get(b.id)!) - (total * (a.weight_percent ?? 0) / weight - targets.get(a.id)!));
    const id = available[0].id;
    targets.set(id, targets.get(id)! + 1);
    allocated++;
  }
  return targets;
}

export async function selectBetaQuestionsByGuide(client: SupabaseClient, certId: BetaDiagnosticCertId, total: number): Promise<SelectionResult> {
  const { sections } = betaDiagnosticMetadata(certId);
  type Row = { id: string; stem: string; domain_id: string; difficulty: string | null; exam_domains: { code: string; name: string }; answers: CanonicalAnswer[] };
  const pools = new Map<string, Row[]>();
  const sectionIds = new Set(sections.map(section => section.id));
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("questions")
      .select("id,stem,domain_id,difficulty,exam_domains!inner(code,name),answers(choice_label,choice_text,is_correct)")
      .eq("exam", certId).eq("status", "ACTIVE").eq("review_status", "GOOD")
      .eq("question_type", "single_select").is("parent_question_id", null)
      .order("id").range(offset, offset + pageSize - 1);
    if (error) throw new Error("Beta question inventory unavailable");
    const rows = (data ?? []) as unknown as Row[];
    for (const row of rows) {
      if (!sectionIds.has(row.exam_domains.code) || !row.stem.trim() || !hasValidAnswers(row.answers)) continue;
      const pool = pools.get(row.exam_domains.code) ?? [];
      pool.push(row); pools.set(row.exam_domains.code, pool);
    }
    if (rows.length < pageSize) break;
  }
  const availability = new Map([...pools].map(([code, pool]) => [code, pool.length]));
  const targets = calculateBetaDomainTargets(total, sections, availability);
  const questions: SelectionResult["questions"] = [];
  const domainDistribution: SelectionResult["domainDistribution"] = [];
  for (const [code, targetCount] of targets) {
    const selected = pickPreferred(pools.get(code) ?? [], targetCount);
    questions.push(...selected.map(row => ({ id: row.id, stem: row.stem, domain_id: row.domain_id, domain_code: code, domain_name: row.exam_domains.name, difficulty: row.difficulty, answers: row.answers })));
    domainDistribution.push({ domainCode: code, targetCount, availableCount: availability.get(code) ?? 0, selectedCount: selected.length });
  }
  if (questions.length !== total || new Set(questions.map(question => question.id)).size !== total) throw new Error("Insufficient beta question inventory");
  return { questions: shuffleArray(questions), domainDistribution };
}
