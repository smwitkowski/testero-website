import { describe, expect, it, vi } from "vitest";
import { includedSessionItem, liveSessionItem, readWithdrawalSnapshot } from "@/lib/questions/session-snapshot";
const active = { status: "ACTIVE", review_status: "GOOD" };
describe("withdrawal snapshot deploy compatibility", () => {
  it.each(["42703", "PGRST204"])("retries only a missing withdrawn_at column (%s)", async code => {
    const read = vi.fn(async (marker: boolean) => marker
      ? { data: null, error: { code, message: "column session_items.withdrawn_at does not exist" } }
      : { data: [], error: null });
    expect(await readWithdrawalSnapshot(read)).toEqual({ data: [], error: null });
    expect(read.mock.calls).toEqual([[true], [false]]);
  });
  it.each([{ code: "42501", message: "withdrawn_at denied" }, { code: "42703", message: "other_column missing" }, { code: "XX000", message: "network" }])("does not mask other read failures %#", async error => {
    const read = vi.fn(async () => ({ data: null, error }));
    expect((await readWithdrawalSnapshot(read)).error).toEqual(error); expect(read).toHaveBeenCalledOnce();
  });
  it("keeps legacy live fences and stable completed snapshots", () => {
    expect(includedSessionItem({ questions: active }, true)).toBe(true);
    expect(includedSessionItem({ questions: { ...active, status: "DRAFT" } }, true)).toBe(false);
    expect(includedSessionItem({ withdrawn_at: "2026-10-24", questions: active }, true)).toBe(false);
    const laterWithdrawn = { withdrawn_at: null, questions: { ...active, status: "DRAFT" } };
    expect(includedSessionItem(laterWithdrawn, true)).toBe(true);
    expect(includedSessionItem(laterWithdrawn, false)).toBe(false); expect(liveSessionItem(laterWithdrawn)).toBe(false);
  });
});
