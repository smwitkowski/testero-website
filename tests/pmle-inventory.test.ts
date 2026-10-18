import { beforeEach, expect, it, vi } from "vitest";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
const mocks = vi.hoisted(() => ({ query: { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() }, client: vi.fn(), cacheConfig: [] as unknown[] }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown, ...config: unknown[]) => { mocks.cacheConfig.push(...config); return fn; } }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: mocks.client }));
import { getPmleInventory } from "@/lib/pmle/inventory";
const valid = { id: "one", stem: "Question", exam_domains: { code: PMLE_BLUEPRINT[0].domainCode }, answers: [{ choice_label: "A", choice_text: "First", is_correct: true }, { choice_label: "B", choice_text: "Second", is_correct: false }] };
beforeEach(() => {
  mocks.client.mockReset().mockReturnValue({ from: vi.fn().mockReturnValue(mocks.query) });
  for (const method of [mocks.query.select, mocks.query.eq, mocks.query.order]) method.mockReset().mockReturnValue(mocks.query);
  mocks.query.range.mockReset().mockResolvedValue({ data: [valid, { ...valid, id: "empty", stem: " " }, { ...valid, id: "bad", answers: [] }, { ...valid, id: "other", exam_domains: { code: "UNKNOWN" } }], error: null });
});
it("counts only usable ACTIVE GOOD PMLE questions and observed domains, cached one hour", async () => {
  const inventory = await getPmleInventory();
  expect(inventory).toMatchObject({ count: 1, domainCount: 1 });
  expect(Number.isNaN(Date.parse(inventory!.checkedAt))).toBe(false);
  expect(mocks.query.eq.mock.calls).toEqual([["exam", "GCP_PM_ML_ENG"], ["status", "ACTIVE"], ["review_status", "GOOD"]]);
  expect(mocks.query.range).toHaveBeenCalledWith(0, 999);
  expect(mocks.cacheConfig).toEqual([["active-pmle-question-inventory"], { revalidate: 3600 }]);
});
it("omits inventory on query errors or unavailable service configuration", async () => {
  mocks.query.range.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  expect(await getPmleInventory()).toBeNull();
  mocks.client.mockImplementation(() => { throw new Error("configuration missing"); });
  expect(await getPmleInventory()).toBeNull();
});
