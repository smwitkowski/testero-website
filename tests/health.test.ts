import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, dynamic } from "@/app/api/health/route";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), limit: vi.fn(), abortSignal: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn() }));

beforeEach(() => {
  const query = { select: mocks.select, limit: mocks.limit, abortSignal: mocks.abortSignal };
  mocks.from.mockReset().mockReturnValue(query);
  mocks.select.mockReset().mockReturnValue(query);
  mocks.limit.mockReset().mockReturnValue(query);
  mocks.abortSignal.mockReset().mockResolvedValue({ data: [{ id: "private-row" }], error: null });
  vi.mocked(createServiceSupabaseClient).mockReset().mockReturnValue({ from: mocks.from } as unknown as ReturnType<typeof createServiceSupabaseClient>);
});

describe("public database readiness", () => {
  it("performs only a bounded minimal service read without authentication", async () => {
    expect(dynamic).toBe("force-dynamic");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(createServiceSupabaseClient).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("exam_domains");
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith("id");
    expect(mocks.limit).toHaveBeenCalledExactlyOnceWith(1);
    expect(mocks.abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });
  it("treats an empty successful read as available without disclosing rows", async () => {
    mocks.abortSignal.mockResolvedValue({ data: [], error: null });
    expect(await (await GET()).json()).toEqual({ ok: true });
  });
  it.each(["database", "network", "configuration", "timeout"])("returns only a boolean and 503 for %s failure", async failure => {
    const privateError = new Error("SUPABASE_SERVICE_ROLE_KEY=secret-token; database details");
    if (failure === "database") mocks.abortSignal.mockResolvedValue({ data: null, error: privateError });
    else if (failure === "configuration") vi.mocked(createServiceSupabaseClient).mockImplementation(() => { throw privateError; });
    else mocks.abortSignal.mockRejectedValue(failure === "timeout" ? new DOMException("secret timeout", "TimeoutError") : privateError);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
