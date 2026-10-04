import { expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaidQuestionReview } from "../lib/diagnostic/types";

const QUOTAS: Record<string, number> = {
  ARCHITECTING_LOW_CODE_ML_SOLUTIONS: 2,
  COLLABORATING_TO_MANAGE_DATA_AND_MODELS: 3,
  SCALING_PROTOTYPES_INTO_ML_MODELS: 4,
  SERVING_AND_SCALING_MODELS: 4,
  AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES: 4,
  MONITORING_ML_SOLUTIONS: 3,
};
type BankAnswer = { choice_label: string; choice_text: string; is_correct: boolean; explanation_text: string };
type BankQuestion = {
  id: string; stem: string; status: string; review_status: string; exam: string; source_ref: string | null;
  exam_domains: { code: string; name: string }; answers: BankAnswer[];
  explanations: { explanation_text: string }[];
};
type Snapshot = {
  id: string; question_id: string; stem: string; domain_code: string; domain_name: string;
  options: { label: string; text: string }[]; correct_label: string;
};
export type RestoredItems = Map<string, { snapshot: Snapshot; question: BankQuestion }>;

/** Local fixture SDK only. No mutation, credential files, or hosted endpoints. */
export async function assertRestoredSession(service: SupabaseClient, sessionId: string, total = 20): Promise<RestoredItems> {
  if (process.env.TESTERO_PROD_SCHEMA !== "1") return new Map();
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(url.hostname);
  expect(url.protocol).toBe("http:"); expect(url.port).toBe("56541"); expect(url.search).toBe("");
  const bank = await service.from("questions").select("id,stem,status,review_status,exam,source_ref,exam_domains!inner(code,name),answers(choice_label,choice_text,is_correct,explanation_text),explanations(explanation_text)");
  expect(bank.error).toBeNull(); expect(bank.data).toHaveLength(343);
  const questions = bank.data as unknown as BankQuestion[];
  expect(questions.filter(question => question.status === "ACTIVE")).toHaveLength(145);
  expect(questions.some(question => question.source_ref?.startsWith("local-educational-seed-"))).toBe(false);
  const domains = await service.from("exam_domains").select("id", { count: "exact", head: true });
  expect(domains.error).toBeNull(); expect(domains.count).toBe(29);
  const eligible = questions.filter(question => question.status === "ACTIVE" && question.review_status === "GOOD" && question.exam === "GCP_PM_ML_ENG"
    && question.answers.length === 4 && question.answers.filter(answer => answer.is_correct).length === 1
    && new Set(question.answers.map(answer => answer.choice_label)).size === 4
    && new Set(question.answers.map(answer => answer.choice_text)).size === 4
    && question.answers.every(answer => answer.choice_label.trim() && answer.choice_text.trim() && answer.explanation_text?.trim()));
  for (const [code, quota] of Object.entries(QUOTAS)) {
    expect(eligible.filter(question => question.exam_domains.code === code).length, `${code} supplies quota ${quota} and practice five`).toBeGreaterThanOrEqual(Math.max(5, quota));
  }
  const saved = await service.from("session_items").select("id,question_id,stem,options,correct_label,domain_code,domain_name").eq("session_id", sessionId).order("ordinal");
  expect(saved.error).toBeNull(); expect(saved.data).toHaveLength(total);
  const snapshots = saved.data as Snapshot[];
  expect(new Set(snapshots.map(item => item.question_id)).size).toBe(total);
  const counts: Record<string, number> = {};
  const result: RestoredItems = new Map();
  for (const snapshot of snapshots) {
    const question = eligible.find(question => question.id === snapshot.question_id);
    expect(question, `snapshot ${snapshot.id} uses a restored ACTIVE+GOOD question`).toBeDefined();
    expect(Object.keys(QUOTAS)).toContain(question!.exam_domains.code);
    expect(snapshot.domain_code).toBe(question!.exam_domains.code);
    expect(snapshot.domain_name).toBe(question!.exam_domains.name);
    expect(snapshot.stem).toBe(question!.stem);
    expect(snapshot.options.map(option => option.text).sort()).toEqual(question!.answers.map(answer => answer.choice_text).sort());
    const correct = snapshot.options.find(option => option.label === snapshot.correct_label);
    expect(correct?.text).toBe(question!.answers.find(answer => answer.is_correct)!.choice_text);
    expect(question!.explanations).toHaveLength(1);
    expect(question!.explanations[0].explanation_text.trim()).not.toBe("");
    counts[snapshot.domain_code] = (counts[snapshot.domain_code] ?? 0) + 1;
    result.set(snapshot.id, { snapshot, question: question! });
  }
  if (total === 20) expect(counts).toEqual(QUOTAS);
  else { expect(total).toBe(5); expect(Object.values(counts)).toEqual([5]); }
  return result;
}

/** Compare paid content to canonical text, never shuffled display labels. */
export function assertRestoredPaidReview(review: PaidQuestionReview[], items: RestoredItems) {
  if (process.env.TESTERO_PROD_SCHEMA !== "1") return;
  expect(review).toHaveLength(items.size);
  for (const item of review) {
    const restored = items.get(item.itemId);
    expect(restored).toBeDefined();
    expect(item.explanation).toBe(restored!.question.explanations[0].explanation_text);
    expect(item.options).toHaveLength(restored!.question.answers.length);
    for (const option of item.options) {
      const canonical = restored!.question.answers.find(answer => answer.choice_text === option.text);
      expect(canonical).toBeDefined(); expect(canonical!.explanation_text.trim()).not.toBe("");
      expect(option.explanation).toBe(canonical!.explanation_text);
    }
  }
}
