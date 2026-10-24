import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { hasValidAnswers, type CanonicalAnswer } from "@/lib/diagnostic/pmle-selection";

type InventoryQuestion = { id: string; stem: string; answers: CanonicalAnswer[]; exam_domains: { code: string } };
const readPmleInventory = unstable_cache(async () => {
  const client = createServiceSupabaseClient();
  const domains = new Set(PMLE_BLUEPRINT.map(domain => domain.domainCode));
  const counts = new Map<string, Set<string>>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("questions")
      .select("id,stem,answers(choice_label,choice_text,is_correct),exam_domains!inner(code)")
      .eq("exam", "GCP_PM_ML_ENG").eq("status", "ACTIVE").eq("review_status", "GOOD")
      .is("parent_question_id", null)
      .order("id").range(offset, offset + pageSize - 1);
    if (error || !Array.isArray(data)) throw new Error("PMLE inventory unavailable");
    for (const question of data as unknown as InventoryQuestion[]) {
      const domain = question.exam_domains?.code;
      if (!domains.has(domain) || typeof question.stem !== "string" || !question.stem.trim() || !hasValidAnswers(question.answers)) continue;
      const ids = counts.get(domain) ?? new Set<string>();
      ids.add(question.id); counts.set(domain, ids);
    }
    if (data.length < pageSize) break;
  }
  return { count: [...counts.values()].reduce((sum, ids) => sum + ids.size, 0), domainCount: counts.size, checkedAt: new Date().toISOString() };
}, ["active-pmle-question-inventory"], { revalidate: 300 });

export async function getPmleInventory() {
  try { return await readPmleInventory(); }
  catch { return null; }
}
