import { beforeEach, expect, it, vi } from "vitest";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
const mocks = vi.hoisted(() => ({ query: { select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), range: vi.fn() }, client: vi.fn(), cacheConfig: [] as unknown[] }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown, ...config: unknown[]) => { mocks.cacheConfig.push(...config); return fn; } }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: mocks.client }));
import { getPmleInventory } from "@/lib/pmle/inventory";
const valid = { id: "one", stem: "Question", exam_domains: { code: PMLE_BLUEPRINT[0].domainCode }, answers: [{ choice_label: "A", choice_text: "First", is_correct: true }, { choice_label: "B", choice_text: "Second", is_correct: false }] };
beforeEach(() => {
  mocks.client.mockReset().mockReturnValue({ from: vi.fn().mockReturnValue(mocks.query) });
  for (const method of [mocks.query.select, mocks.query.eq, mocks.query.is, mocks.query.order]) method.mockReset().mockReturnValue(mocks.query);
  mocks.query.range.mockReset().mockResolvedValue({ data: [valid, { ...valid, id: "empty", stem: " " }, { ...valid, id: "bad", answers: [] }, { ...valid, id: "other", exam_domains: { code: "UNKNOWN" } }], error: null });
});
it("counts only usable ACTIVE GOOD PMLE questions and observed domains, cached one hour", async () => {
  const inventory = await getPmleInventory();
  expect(inventory).toMatchObject({ count: 1, domainCount: 1 });
  expect(Number.isNaN(Date.parse(inventory!.checkedAt))).toBe(false);
  expect(mocks.query.eq.mock.calls).toEqual([["exam", "GCP_PM_ML_ENG"], ["status", "ACTIVE"], ["review_status", "GOOD"]]);
  expect(mocks.query.is).toHaveBeenCalledExactlyOnceWith("parent_question_id", null);
  expect(mocks.query.range).toHaveBeenCalledWith(0, 999);
  expect(mocks.cacheConfig).toEqual([["active-pmle-question-inventory"], { revalidate: 3600 }]);
});
it("excludes variants from both bank and domain counts before pagination", async () => {
  const originals = Array.from({ length: 1001 }, (_, index) => ({ ...valid, id: `original-${index}`, parent_question_id: null }));
  const rows = [
    { ...valid, id: "variant", parent_question_id: originals[0].id },
    { ...valid, id: "variant-only-domain", parent_question_id: "other-parent", exam_domains: { code: PMLE_BLUEPRINT[1].domainCode } },
    ...originals,
  ];
  mocks.query.range.mockImplementation(async (first: number, last: number) => {
    const filtered = mocks.query.is.mock.calls.some(([column, value]) => column === "parent_question_id" && value === null)
      ? rows.filter(row => row.parent_question_id === null) : rows;
    return { data: filtered.slice(first, last + 1), error: null };
  });
  expect(await getPmleInventory()).toMatchObject({ count: 1001, domainCount: 1 });
  expect(mocks.query.is.mock.calls).toEqual([["parent_question_id", null], ["parent_question_id", null]]);
  expect(mocks.query.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
  for (let index = 0; index < 2; index++) {
    expect(mocks.query.is.mock.invocationCallOrder[index]).toBeLessThan(mocks.query.range.mock.invocationCallOrder[index]);
  }
});
it("omits inventory on query errors or unavailable service configuration", async () => {
  mocks.query.range.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  expect(await getPmleInventory()).toBeNull();
  mocks.client.mockImplementation(() => { throw new Error("configuration missing"); });
  expect(await getPmleInventory()).toBeNull();
});
