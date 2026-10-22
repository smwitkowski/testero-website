import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import freeSet from "@/lib/chatgpt/free-set.json";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";

const syntheticSource = {
  kind: "local-export", upstream: "read-only-database-content-export",
  exported_at: "2026-10-22T00:00:00.000Z", export_sha256: "a".repeat(64), selection: "synthetic-test",
};

const db = vi.hoisted(() => ({ create: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: db.create }));
// Synthetic authored text only; no source-bank stems, options, or answer keys.
function row(index = 0) {
  return { id: freeSet.question_ids[index], exam: "GCP_PM_ML_ENG", status: "ACTIVE", review_status: "GOOD", question_type: "single_select",
    parent_question_id: null as string | null, stem: `Synthetic scenario ${index}: select the test-designated response.`,
    exam_domains: { code: PMLE_BLUEPRINT[index % 6].domainCode },
    answers: ["A", "B", "C", "D"].map((label, optionIndex) => ({ choice_label: label,
      choice_text: `Synthetic response ${label}.`, is_correct: optionIndex === index % 4,
      explanation_text: `Synthetic explanation ${label}, authored solely for this test.`,
    })),
  };
}
let questions: typeof import("@/lib/chatgpt/questions");
beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("CHATGPT_EXAMS", undefined);
  const query = { select: db.select, eq: db.eq, is: db.is, in: db.in };
  db.create.mockReturnValue({ from: db.from }); db.from.mockReturnValue(query);
  db.select.mockReturnValue(query); db.eq.mockReturnValue(query); db.is.mockReturnValue(query);
  db.in.mockResolvedValue({ data: [row()], error: null });
  questions = await import("@/lib/chatgpt/questions");
});
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  vi.doUnmock("@/lib/chatgpt/free-set.json"); vi.doUnmock("@/lib/chatgpt/free-sets.json");
});

describe("ChatGPT server-only allowlist question loader", () => {
  it("selects all eligibility fields and enforces every database predicate", async () => {
    expect(questions.CHATGPT_SELECTION_SIZE).toBe(40);
    expect(questions.isAllowedQuestionId(freeSet.question_ids[0])).toBe(true);
    expect(questions.isAllowedQuestionId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(false);
    const loaded = await questions.loadChatgptQuestions();
    expect(loaded).toHaveLength(1);
    expect(loaded![0]).toMatchObject({ exam: "GCP_PM_ML_ENG", id: row().id, domain: row().exam_domains.code, stem: row().stem });
    expect(db.create).toHaveBeenCalledOnce();
    expect(db.from).toHaveBeenCalledExactlyOnceWith("questions");
    expect(db.select).toHaveBeenCalledExactlyOnceWith("id,exam,status,review_status,question_type,parent_question_id,stem,exam_domains!inner(code),answers(choice_label,choice_text,is_correct,explanation_text)");
    expect(db.eq.mock.calls).toEqual([["exam", "GCP_PM_ML_ENG"], ["status", "ACTIVE"], ["review_status", "GOOD"], ["question_type", "single_select"]]);
    expect(db.is).toHaveBeenCalledExactlyOnceWith("parent_question_id", null);
    expect(db.in).toHaveBeenCalledExactlyOnceWith("id", freeSet.question_ids);
  });

  it("retains deterministic selection order and canonical A–D order", async () => {
    const second = row(1); second.answers.reverse();
    db.in.mockResolvedValue({ data: [second, row()], error: null });
    const loaded = await questions.loadChatgptQuestions();
    expect(loaded!.map(question => question.id)).toEqual(freeSet.question_ids.slice(0, 2));
    expect(loaded![1].options.map(option => option.label)).toEqual(["A", "B", "C", "D"]);
  });

  it.each([
    ["outside allowlist", (value: ReturnType<typeof row>) => { value.id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; }],
    ["variant", (value: ReturnType<typeof row>) => { value.parent_question_id = freeSet.question_ids[1]; }],
    ["inactive", (value: ReturnType<typeof row>) => { value.status = "INACTIVE"; }],
    ["retired", (value: ReturnType<typeof row>) => { value.status = "RETIRED"; }],
    ["unreviewed", (value: ReturnType<typeof row>) => { value.review_status = "PENDING"; }],
    ["wrong exam", (value: ReturnType<typeof row>) => { value.exam = "OTHER_EXAM"; }],
    ["multiple select", (value: ReturnType<typeof row>) => { value.question_type = "multiple_select"; }],
    ["wrong domain", (value: ReturnType<typeof row>) => { value.exam_domains.code = "OTHER_DOMAIN"; }],
    ["blank stem", (value: ReturnType<typeof row>) => { value.stem = " "; }],
    ["three answers", (value: ReturnType<typeof row>) => { value.answers.pop(); }],
    ["five answers", (value: ReturnType<typeof row>) => { value.answers.push({ ...value.answers[0] }); }],
    ["duplicate label", (value: ReturnType<typeof row>) => { value.answers[1].choice_label = "A"; }],
    ["unknown label", (value: ReturnType<typeof row>) => { value.answers[1].choice_label = "E"; }],
    ["multiple keys", (value: ReturnType<typeof row>) => { value.answers[1].is_correct = true; }],
    ["no key", (value: ReturnType<typeof row>) => { value.answers[0].is_correct = false; }],
    ["blank option", (value: ReturnType<typeof row>) => { value.answers[0].choice_text = " "; }],
    ["blank explanation", (value: ReturnType<typeof row>) => { value.answers[0].explanation_text = " "; }],
  ])("drops malicious or malformed returned rows: %s", async (_name, change) => {
    const invalid = row(); change(invalid);
    db.in.mockResolvedValue({ data: [invalid, row(1)], error: null });
    const loaded = await questions.loadChatgptQuestions();
    expect(loaded!.map(question => question.id)).toEqual([freeSet.question_ids[1]]);
    // Only validated rows enter the cache.
    expect(await questions.loadChatgptQuestions()).toEqual(loaded);
    expect(db.in).toHaveBeenCalledOnce();
  });

  it.each([null, {}, { ...row(), parent_question_id: undefined }, { ...row(), question_type: undefined }, { ...row(), exam_domains: null },
    { ...row(), exam_domains: [{ code: PMLE_BLUEPRINT[0].domainCode }] },
    { ...row(), answers: [{ ...row().answers[0], is_correct: "true" }, ...row().answers.slice(1)] },
  ])("drops invalid returned structure without throwing", async invalid => {
    db.in.mockResolvedValue({ data: [invalid], error: null });
    expect(await questions.loadChatgptQuestions()).toEqual([]);
  });

  it.each(["price", "prices", "pricing", "checkout", "upsell", "upgrade", "buy", "purchase", "USD", "$ 12", "/pass", "/passes?x=1"])("blocks changed policy-unsafe content in every field: %s", async term => {
    const stem = row(); stem.stem = `Synthetic ${term} text`;
    const option = row(1); option.answers[0].choice_text = `Synthetic ${term} text`;
    const explanation = row(2); explanation.answers[0].explanation_text = `Synthetic ${term} text`;
    db.in.mockResolvedValue({ data: [stem, option, explanation], error: null });
    expect(await questions.loadChatgptQuestions()).toEqual([]);
  });

  it("drops ambiguous duplicate IDs even if one row is otherwise invalid", async () => {
    db.in.mockResolvedValue({ data: [row(), { ...row(), status: "RETIRED" }, row(1)], error: null });
    expect((await questions.loadChatgptQuestions())!.map(question => question.id)).toEqual([freeSet.question_ids[1]]);
  });

  it.each([
    { data: [row()], error: { message: "private database details" } },
    { data: null, error: null }, { data: {}, error: null },
  ])("fails closed on a database error or malformed payload", async response => {
    db.in.mockResolvedValue(response);
    expect(await questions.loadChatgptQuestions()).toBeNull();
  });

  it("uses a short instance cache but discards expired content before a failed refresh", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const first = await questions.loadChatgptQuestions();
    now.mockReturnValue(1_029_999);
    expect(await questions.loadChatgptQuestions()).toBe(first);
    expect(db.in).toHaveBeenCalledOnce();
    now.mockReturnValue(1_030_000);
    db.in.mockResolvedValue({ data: null, error: { message: "private database failure" } });
    expect(await questions.loadChatgptQuestions()).toBeNull();
    db.in.mockRejectedValue(new Error("private transport failure"));
    expect(await questions.loadChatgptQuestions()).toBeNull();
    expect(db.in).toHaveBeenCalledTimes(3);
    db.in.mockResolvedValue({ data: [row(1)], error: null });
    expect((await questions.loadChatgptQuestions())!.map(question => question.id)).toEqual([freeSet.question_ids[1]]);
  });

  it("revalidates changed eligibility after cache expiry", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    expect(await questions.loadChatgptQuestions()).toHaveLength(1);
    now.mockReturnValue(1_030_000);
    db.in.mockResolvedValue({ data: [{ ...row(), status: "RETIRED" }], error: null });
    expect(await questions.loadChatgptQuestions()).toEqual([]);
  });

  it("deduplicates concurrent async loads without exposing partial content", async () => {
    let finish!: (value: unknown) => void;
    db.in.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    let settled = false;
    const first = questions.loadChatgptQuestions().then(value => { settled = true; return value; });
    const second = questions.loadChatgptQuestions();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(db.in).toHaveBeenCalledOnce();
    finish({ data: [row()], error: null });
    expect(await first).toEqual(await second);
  });

  it("catches service-client configuration errors without caching failures", async () => {
    db.create.mockImplementation(() => { throw new Error("SUPABASE secret"); });
    expect(await questions.loadChatgptQuestions()).toBeNull();
    expect(await questions.loadChatgptQuestions()).toBeNull();
    expect(db.create).toHaveBeenCalledTimes(2);
  });

  it.each([
    { ...freeSet, question_ids: freeSet.question_ids.slice(1) },
    { ...freeSet, question_ids: [...freeSet.question_ids.slice(1), freeSet.question_ids[1]] },
    { ...freeSet, question_ids: ["invalid", ...freeSet.question_ids.slice(1)] },
    { ...freeSet, questions: [] },
  ])("fails closed before database access for a malformed selection", async selection => {
    vi.doMock("@/lib/chatgpt/free-set.json", () => ({ default: selection }));
    vi.resetModules();
    const loader = await import("@/lib/chatgpt/questions");
    expect(loader.CHATGPT_SELECTION_SIZE).toBe(0);
    expect(await loader.loadChatgptQuestions()).toBeNull();
    expect(db.create).not.toHaveBeenCalled();
  });

  describe("per-exam selection and cache isolation", () => {
    const extraId = "11111111-1111-4111-8111-111111111111";
    const extraExam = "data-engineer";
    const extraDomain = "data-engineer:standard:1";
    function extraRow() {
      return { ...row(), id: extraId, exam: extraExam, exam_domains: { code: extraDomain } };
    }
    async function enableExtra(ids = [extraId]) {
      vi.doMock("@/lib/chatgpt/free-sets.json", () => ({ default: {
        [extraExam]: { version: 1, source: syntheticSource, question_ids: ids },
      } }));
      vi.stubEnv("CHATGPT_EXAMS", `GCP_PM_ML_ENG,${extraExam}`);
      vi.resetModules();
      questions = await import("@/lib/chatgpt/questions");
    }

    it("keeps the default PMLE-only and rejects unknown or disabled exams before DB access", async () => {
      expect(questions.findQuestionExam(freeSet.question_ids[0])?.id).toBe("GCP_PM_ML_ENG");
      expect(questions.findQuestionExam(extraId)).toBeUndefined();
      expect(questions.isAllowedQuestionId(extraId, extraExam)).toBe(false);
      expect(await questions.loadChatgptQuestions(extraExam)).toBeNull();
      expect(await questions.loadChatgptQuestions("not-an-exam")).toBeNull();
      expect(db.create).not.toHaveBeenCalled();
    });

    it("loads an enabled extra set with its own predicates and drops cross-exam IDs and domains", async () => {
      await enableExtra();
      expect(questions.isAllowedQuestionId(extraId)).toBe(false);
      expect(questions.isAllowedQuestionId(extraId, extraExam)).toBe(true);
      expect(questions.isAllowedQuestionId(freeSet.question_ids[0], extraExam)).toBe(false);
      expect(questions.findQuestionExam(extraId)?.id).toBe(extraExam);
      db.in.mockResolvedValue({ data: [extraRow(), row(), { ...row(1), exam: extraExam,
        exam_domains: { code: extraDomain } }], error: null });
      const loaded = await questions.loadChatgptQuestions(extraExam);
      expect(loaded).toHaveLength(1);
      expect(loaded![0]).toMatchObject({ id: extraId, exam: extraExam, domain: extraDomain });
      expect(db.eq.mock.calls).toEqual([["exam", extraExam], ["status", "ACTIVE"],
        ["review_status", "GOOD"], ["question_type", "single_select"]]);
      expect(db.in).toHaveBeenCalledExactlyOnceWith("id", [extraId]);
      db.in.mockResolvedValue({ data: [row(), extraRow()], error: null });
      expect((await questions.loadChatgptQuestions())!.map(question => question.id)).toEqual([freeSet.question_ids[0]]);
      expect(await questions.loadChatgptQuestions(extraExam)).toBe(loaded);
      expect(db.in).toHaveBeenCalledTimes(2);
    });

    it("validates extra-exam domain membership instead of PMLE domains", async () => {
      await enableExtra();
      db.in.mockResolvedValue({ data: [{ ...extraRow(), exam_domains: row().exam_domains }], error: null });
      expect(await questions.loadChatgptQuestions(extraExam)).toEqual([]);
    });

    it("does not resolve answer checks to a set when an ID belongs to two enabled exams", async () => {
      await enableExtra([freeSet.question_ids[0]]);
      expect(questions.findQuestionExam(freeSet.question_ids[0])).toBeUndefined();
      expect(questions.isAllowedQuestionId(freeSet.question_ids[0])).toBe(false);
      expect(await questions.loadChatgptQuestions()).toBeNull();
      expect(await questions.loadChatgptQuestions(extraExam)).toBeNull();
      expect(db.create).not.toHaveBeenCalled();
      vi.stubEnv("CHATGPT_EXAMS", "GCP_PM_ML_ENG");
      expect(questions.findQuestionExam(freeSet.question_ids[0])?.id).toBe("GCP_PM_ML_ENG");
    });

    it("discards a disabled exam's warm cache immediately and does not accept its IDs", async () => {
      await enableExtra();
      db.in.mockResolvedValue({ data: [extraRow()], error: null });
      expect(await questions.loadChatgptQuestions(extraExam)).toHaveLength(1);
      vi.stubEnv("CHATGPT_EXAMS", "GCP_PM_ML_ENG");
      expect(await questions.loadChatgptQuestions(extraExam)).toBeNull();
      expect(questions.isAllowedQuestionId(extraId, extraExam)).toBe(false);
      expect(questions.findQuestionExam(extraId)).toBeUndefined();
      expect(db.in).toHaveBeenCalledOnce();
    });

    it("deduplicates loads within each exam but never across exams", async () => {
      await enableExtra();
      const finish: ((value: unknown) => void)[] = [];
      db.in.mockImplementation(() => new Promise(resolve => { finish.push(resolve); }));
      const pmle = questions.loadChatgptQuestions();
      const extra = questions.loadChatgptQuestions(extraExam);
      const extraAgain = questions.loadChatgptQuestions(extraExam);
      expect(db.in).toHaveBeenCalledTimes(2);
      finish[1]({ data: [extraRow()], error: null });
      expect(await extra).toEqual(await extraAgain);
      finish[0]({ data: [row()], error: null });
      expect((await pmle)![0].exam).toBe("GCP_PM_ML_ENG");
    });

    it("rejects a result when the enabled exam is removed during its database read", async () => {
      await enableExtra();
      let finish!: (value: unknown) => void;
      db.in.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
      const pending = questions.loadChatgptQuestions(extraExam);
      vi.stubEnv("CHATGPT_EXAMS", "GCP_PM_ML_ENG");
      finish({ data: [extraRow()], error: null });
      expect(await pending).toBeNull();
    });

    it("does not let one exam's failed refresh evict another exam's cached content", async () => {
      await enableExtra();
      const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
      const pmle = await questions.loadChatgptQuestions();
      now.mockReturnValue(1_010_000);
      db.in.mockResolvedValue({ data: [extraRow()], error: null });
      const extra = await questions.loadChatgptQuestions(extraExam);
      now.mockReturnValue(1_030_000);
      db.in.mockResolvedValue({ data: null, error: { message: "synthetic failure" } });
      expect(await questions.loadChatgptQuestions()).toBeNull();
      expect(await questions.loadChatgptQuestions(extraExam)).toBe(extra);
      expect(pmle).toHaveLength(1);
      expect(db.in).toHaveBeenCalledTimes(3);
    });

    it("fails closed for invalid allowlist configuration even with a warm PMLE cache", async () => {
      expect(await questions.loadChatgptQuestions()).toHaveLength(1);
      vi.stubEnv("CHATGPT_EXAMS", "GCP_PM_ML_ENG,unknown");
      expect(await questions.loadChatgptQuestions()).toBeNull();
      expect(questions.isAllowedQuestionId(freeSet.question_ids[0])).toBe(false);
      expect(questions.findQuestionExam(freeSet.question_ids[0])).toBeUndefined();
      expect(db.in).toHaveBeenCalledOnce();
    });
  });
});
