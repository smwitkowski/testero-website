import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { calculateDomainTargets } from "@/lib/diagnostic/pmle-selection";
import { shuffleArray } from "@/lib/questions/answer-order";
export const MOCK_QUESTION_COUNT = 50;
export const MOCK_DURATION_MINUTES = 120;

/** Exhaust the unseen pool before seen fallback; fit blueprint weights where inventory allows. */
export function selectMockQuestions<T extends { id: string; domain_code: string }>(bank: readonly T[], answeredIds: ReadonlySet<string>) {
  const known = new Set(PMLE_BLUEPRINT.map(domain => domain.domainCode));
  const unique = [...new Map(bank.filter(question => known.has(question.domain_code)).map(question => [question.id, question])).values()];
  const ideal = calculateDomainTargets(MOCK_QUESTION_COUNT, new Map(PMLE_BLUEPRINT.map(domain => [domain.domainCode, MOCK_QUESTION_COUNT])));
  const selected: T[] = [];
  for (const seen of [false, true]) {
    const pool = unique.filter(question => answeredIds.has(question.id) === seen);
    const availability = new Map(PMLE_BLUEPRINT.map(domain => [domain.domainCode, pool.filter(question => question.domain_code === domain.domainCode).length]));
    const remaining = MOCK_QUESTION_COUNT - selected.length;
    // Fill each ideal domain deficit first, then redistribute any stock shortfall.
    const desired = new Map(PMLE_BLUEPRINT.map(domain => [domain.domainCode, Math.max(0, (ideal.get(domain.domainCode) ?? 0) - selected.filter(question => question.domain_code === domain.domainCode).length)]));
    const stage: T[] = [];
    for (const [code, count] of desired) stage.push(...shuffleArray(pool.filter(question => question.domain_code === code)).slice(0, count));
    const chosen = new Set(stage.map(question => question.id));
    const extraPool = pool.filter(question => !chosen.has(question.id));
    const extraTargets = calculateDomainTargets(Math.max(0, remaining - stage.length), new Map([...availability].map(([code]) => [code, extraPool.filter(question => question.domain_code === code).length])));
    for (const [code, count] of extraTargets) stage.push(...shuffleArray(extraPool.filter(question => question.domain_code === code)).slice(0, count));
    selected.push(...stage.slice(0, remaining));
    if (selected.length === MOCK_QUESTION_COUNT) break;
  }
  const shortfall = [...ideal].some(([code, count]) => selected.filter(question => question.domain_code === code).length !== count);
  // Below 50 total, repeat only after every distinct question has been used.
  const repeated = selected.length > 0 && selected.length < MOCK_QUESTION_COUNT;
  const distinct = shuffleArray(selected).sort((a, b) => Number(answeredIds.has(a.id)) - Number(answeredIds.has(b.id)));
  const questions = [...distinct];
  while (questions.length && questions.length < MOCK_QUESTION_COUNT) questions.push(distinct[(questions.length - distinct.length) % distinct.length]);
  const notice = repeated
    ? "The bank has fewer than 50 eligible questions. This mock repeats questions after using every available question, and its domain mix may differ from the exam blueprint."
    : shortfall ? "Some domains have too few fresh questions for the exam blueprint. This mock fills the shortfall from other domains, using unanswered questions first." : null;
  return { questions, allocationNotice: notice };
}
