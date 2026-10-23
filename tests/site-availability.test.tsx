import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDiagnosticAvailability, getDiagnosticAvailabilityMap } from "@/lib/certifications/availability";
import { certifications } from "@/lib/certifications/catalog";

const db = vi.hoisted(() => ({ count: 20 as number | null, error: null as unknown, missingConfig: false, queries: [] as unknown[][] }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => {
    if (db.missingConfig) throw new Error("Missing configuration");
    const query = {
      select: (...args: unknown[]) => { db.queries.push(["select", ...args]); return query; },
      eq: (...args: unknown[]) => { db.queries.push(["eq", ...args]); return query; },
      is: (...args: unknown[]) => { db.queries.push(["is", ...args]); return query; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ count: db.count, error: db.error }).then(resolve),
    };
    return { from: () => query };
  },
}));
beforeEach(() => { db.count = 20; db.error = null; db.missingConfig = false; db.queries = []; });

describe("one diagnostic availability source", () => {
  it("keeps PMLE available without service configuration and unknown exams closed", async () => {
    db.missingConfig = true;
    expect(await getDiagnosticAvailability("machine-learning-engineer")).toBe("available");
    expect(await getDiagnosticAvailability("unknown")).toBe("coming-soon");
  });
  it.each(["data-engineer", "cloud-architect", "cloud-engineer", "generative-ai-leader", "agentic-architect"])("does not hardcode PDE: opens approved allowlisted %s", async certId => {
    vi.stubEnv("BETA_DIAGNOSTIC_CERTS", certId);
    expect(await getDiagnosticAvailability(certId)).toBe("beta");
    expect(db.queries).toEqual([
      ["select", "id", { count: "exact", head: true }], ["eq", "exam", certId],
      ["eq", "status", "ACTIVE"], ["eq", "review_status", "GOOD"],
      ["eq", "question_type", "single_select"], ["is", "parent_question_id", null],
    ]);
  });
  it.each([0, 19, null])("does not advertise an undersupplied bank at %s", async count => {
    vi.stubEnv("BETA_DIAGNOSTIC_CERTS", "data-engineer"); db.count = count;
    expect(await getDiagnosticAvailability("data-engineer")).toBe("coming-soon");
  });
  it("requires an exact env allowlist entry even with enough approved questions", async () => {
    vi.stubEnv("BETA_DIAGNOSTIC_CERTS", "data-engineer-extra");
    expect(await getDiagnosticAvailability("data-engineer")).toBe("coming-soon");
    expect(db.queries).toEqual([]);
  });
  it("fails closed on missing config and bank query errors", async () => {
    vi.stubEnv("BETA_DIAGNOSTIC_CERTS", "data-engineer");
    db.missingConfig = true;
    expect(await getDiagnosticAvailability("data-engineer")).toBe("coming-soon");
    db.missingConfig = false; db.error = { message: "Unavailable" };
    expect(await getDiagnosticAvailability("data-engineer")).toBe("coming-soon");
  });
  it("returns every marketed certification and shares the individual live gate", async () => {
    vi.stubEnv("BETA_DIAGNOSTIC_CERTS", "data-engineer,cloud-architect");
    const statuses = await getDiagnosticAvailabilityMap();
    expect(Object.keys(statuses)).toEqual(certifications.map(cert => cert.cert_id));
    expect(statuses["machine-learning-engineer"]).toBe("available");
    expect(statuses["data-engineer"]).toBe("beta");
    expect(statuses["cloud-architect"]).toBe("beta");
    expect(statuses["cloud-engineer"]).toBe("coming-soon");
  });
});
