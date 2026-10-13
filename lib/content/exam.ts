export const PMLE_EXAM = "Professional Machine Learning Engineer";

// Catalog metadata lives alongside the byte-locked historical sources.
// Omit exam for PMLE; name any other exam or certificate in full.
export function contentExam(item: { exam?: string }): string {
  return item.exam ?? PMLE_EXAM;
}

export function isComingSoon(exam: string): boolean {
  return exam !== PMLE_EXAM;
}
