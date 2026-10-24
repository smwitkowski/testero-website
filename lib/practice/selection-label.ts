import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";

export interface PracticeSelection {
  reason: "history" | "diagnostic_focus" | "general";
  domainCode: string;
  message: string;
}
export const WEAK_AREA_MIN_ANSWERS = 5;

/** Rebuild display text from stored server selection, never URL or stored prose. */
export function restorePracticeSelection(value: unknown): PracticeSelection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== 2 || !Object.hasOwn(row, "reason") || !Object.hasOwn(row, "domainCode")) return null;
  const domain = PMLE_BLUEPRINT.find(domain => domain.domainCode === row.domainCode);
  if (!domain || typeof row.reason !== "string" || !["history", "diagnostic_focus", "general"].includes(row.reason)) return null;
  const reason = row.reason as PracticeSelection["reason"];
  const message = reason === "history"
    ? `Practicing ${domain.displayName}: your lowest-scoring domain with at least ${WEAK_AREA_MIN_ANSWERS} different answered questions.`
    : reason === "diagnostic_focus"
      ? `Not enough practice history yet. Starting with ${domain.displayName}, the study focus from your latest diagnostic.`
      : `Not enough answered history or a completed diagnostic yet. Start with ${domain.displayName} to build your study history.`;
  return { reason, domainCode: domain.domainCode, message };
}
