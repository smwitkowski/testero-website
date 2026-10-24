import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticStart } from "@/components/diagnostic-start";
import { DiagnosticSession } from "@/components/diagnostic-session";
import { DiagnosticResults } from "@/components/diagnostic-results";
import { CertWaitlistForm } from "@/components/cert-waitlist-form";
import DiagnosticStartPage, { generateMetadata } from "@/app/diagnostic/page";
import { pageMetadata } from "@/lib/seo";
import { certifications, PMLE_CERT_ID } from "@/lib/certifications/catalog";

const mocks = vi.hoisted(() => ({ resource: vi.fn(), availability: vi.fn(), findOpen: vi.fn(), client: {}, credentials: { token: "test-token" }, pathname: "/diagnostic" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname, useRouter: () => ({ replace: vi.fn() }), notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/components/diagnostic-resource", () => ({ useDiagnosticResource: mocks.resource, diagnosticRequest: vi.fn(), requestError: () => "Error" }));
vi.mock("@/lib/diagnostic/beta", () => ({ isBetaDiagnosticCertId: (certId: string) => ["data-engineer", "cloud-architect", "cloud-engineer", "generative-ai-leader", "agentic-architect"].includes(certId) }));
vi.mock("@/lib/certifications/availability", () => ({ getDiagnosticAvailability: mocks.availability }));
vi.mock("@/lib/diagnostic/service", () => ({ findOpenDiagnostic: mocks.findOpen }));
vi.mock("@/lib/diagnostic/request", () => ({ diagnosticCredentials: async () => mocks.credentials }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => mocks.client }));
vi.mock("@/components/free-diagnostic-explanation", () => ({ FreeDiagnosticExplanation: () => createElement("p", null, "PMLE explanation") }));
vi.mock("@/components/diagnostic-unlock", () => ({ DiagnosticPassOption: () => createElement("p", null, "PMLE Pass checkout"), SignedInDiagnosticUnlock: () => createElement("p", null, "PMLE Pass unlock") }));
vi.mock("@/components/results-email-form", () => ({ ResultsEmailForm: () => createElement("p", null, "Results email") }));
vi.mock("@/components/report-question", () => ({ ReportQuestion: () => null }));
vi.mock("@/lib/analytics/client", () => ({ trackDiagnosticAnswer: vi.fn(), trackResults: vi.fn() }));
const betaIds = ["data-engineer", "cloud-architect", "cloud-engineer", "generative-ai-leader", "agentic-architect"];
beforeEach(() => {
  mocks.availability.mockReset().mockImplementation(async (certId: string) => certId === PMLE_CERT_ID ? "available" : "beta");
  mocks.findOpen.mockReset().mockResolvedValue(null);
  mocks.resource.mockReset();
  mocks.pathname = "/diagnostic";
});

describe("beta diagnostic UI", () => {
  it.each(betaIds)("offers only 5/10 with correct identity, neutral copy and cert-scoped resume for %s", certId => {
    const certName = certifications.find(cert => cert.cert_id === certId)!.name;
    const html = renderToStaticMarkup(createElement(DiagnosticStart, { certId, certName, domainCount: 4, resumeId: "saved-session", initialCount: 20 }));
    expect(html).toContain(certName);
    expect(html).toContain('checked="" value="5"');
    expect(html).toContain('value="10"');
    expect(html).not.toContain('value="20"');
    expect(html).toContain(`href="/diagnostic/saved-session?cert=${certId}"`);
    for (const pmleCopy of ["PMLE", "six exam domains", "five highest-weight", "domain to practice", "Scores for the domains", "full 20"]) expect(html).not.toContain(pmleCopy);
  });
  it.each([5, 10, 20] as const)("preserves PMLE length %s and existing copy", initialCount => {
    const html = renderToStaticMarkup(createElement(DiagnosticStart, { initialCount, resumeId: "pmle-session" }));
    expect(html).toContain(`checked="" value="${initialCount}"`);
    expect(html).toContain('value="20"');
    expect(html).toContain(`Free ${initialCount}-question PMLE check`);
    expect(html).toContain('href="/diagnostic/pmle-session"');
  });
  it.each(betaIds.flatMap(certId => [5, 10].map(totalQuestions => ({ certId, totalQuestions }))))("keeps $certId $totalQuestions-question results tier-only, with practice waitlist and cert retake", ({ certId, totalQuestions }) => {
    mocks.resource.mockReturnValue({ data: {
      sessionId: "session", certId, score: 40, correctAnswers: totalQuestions * 0.4, totalQuestions,
      readiness: { id: "building", label: "Building", description: "Study guidance" },
      // Even an unexpected richer payload must not expose PMLE review or practice.
      domainBreakdown: [{ domainCode: "WEAK", domainName: "Hidden domain", total: 2, correct: 0, percentage: 0 }], review: [],
    } });
    const html = renderToStaticMarkup(createElement(DiagnosticResults, { sessionId: "session", aboveFoldCta: createElement("p", null, "Injected checkout CTA"), emailCard: createElement("p", null, "Injected email") }));
    const certName = certifications.find(cert => cert.cert_id === certId)!.name;
    expect(html).toContain(`${certName} readiness report`);
    expect(html).toContain("Tier: Building");
    expect(html).toContain("data-beta-diagnostic-results");
    expect(html).toContain('body:has([data-beta-diagnostic-results]) header a[href="/pricing"] { display: none; }');
    expect(html).toContain(`Practice for ${certName} is in beta and coming soon`);
    expect(html).toContain(`Get notified when practice for ${certName} opens`);
    expect(html).toContain(`id="cert-email-${certId}"`);
    expect(html).toContain(`href="/diagnostic?cert=${certId}"`);
    for (const forbidden of ["PMLE", "checkout", 'href="/pricing" class=', "$39", "Start practice", "/dashboard", "/signup", "Results email", "Injected email", "Score by domain", "Hidden domain", "explanation", "Question review", "length=20", "Overall score", "Readiness score", "/ 100", "2 of 5 correct", "4 of 10 correct"]) expect(html).not.toContain(forbidden);
  });
  it("does not add the beta commerce-hiding marker or style to PMLE results", () => {
    mocks.resource.mockReturnValue({ data: { sessionId: "session", certId: PMLE_CERT_ID, score: 40, correctAnswers: 2, totalQuestions: 5, domainBreakdown: [] } });
    const html = renderToStaticMarkup(createElement(DiagnosticResults, { sessionId: "session" }));
    expect(html).not.toContain("data-beta-diagnostic-results");
    expect(html).not.toContain("body:has");
    expect(html).toContain("PMLE Pass checkout");
    expect(html).toContain('aria-label="Overall score"');
  });
  it("keeps the existing diagnostic waitlist copy by default", () => {
    const html = renderToStaticMarkup(createElement(CertWaitlistForm, { certId: "data-engineer", certName: "Professional Data Engineer" }));
    expect(html).toContain("the Professional Data Engineer diagnostic is ready");
    expect(html).toContain("Only a launch notification for this diagnostic");
  });
  it("shows persisted beta identity and domain labels without a 10-question domain-report promise", () => {
    mocks.resource.mockReturnValue({ data: { sessionId: "session", certId: "data-engineer", status: "in_progress", totalQuestions: 10, answeredCount: 5, answeredQuestions: [], currentQuestion: { id: "item", ordinal: 6, domainCode: "DESIGN", domainName: "Designing data processing systems", stem: "A beta scenario", options: [{ label: "A", text: "Option A" }] } } });
    const html = renderToStaticMarkup(createElement(DiagnosticSession, { sessionId: "session" }));
    expect(html).toContain("Professional Data Engineer");
    expect(html).toContain("Designing data processing systems");
    expect(html).toContain("Your readiness signal is taking shape");
    expect(html).not.toContain("Your domain picture");
  });
});

describe("server-gated diagnostic entry", () => {
  it.each(betaIds)("uses cert-specific beta metadata for %s using live availability", async cert => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ cert }) });
    expect(metadata.title).toBe(`Free ${certifications.find(item => item.cert_id === cert)!.name} beta diagnostic`);
    expect(metadata.description).toContain("5 or 10");
    expect(metadata.alternates?.canonical).toBe(`https://testero.ai/diagnostic?cert=${cert}`);
    expect(metadata.openGraph?.url).toBe(`https://testero.ai/diagnostic?cert=${cert}`);
    expect(mocks.availability).toHaveBeenCalledWith(cert);
    expect(mocks.findOpen).not.toHaveBeenCalled();
  });
  it.each([undefined, PMLE_CERT_ID])("preserves exact PMLE metadata (%s)", async cert => {
    expect(await generateMetadata({ searchParams: Promise.resolve({ cert }) })).toEqual(pageMetadata("Start your free PMLE diagnostic", "Choose 5, 10 or 20 PMLE questions. See your readiness and study focus without an account.", "/diagnostic"));
  });
  it.each(["unknown"])("does not claim a beta diagnostic for unsupported cert %s", async cert => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ cert }) });
    expect(metadata.title).toBe("Diagnostic");
    expect(metadata.description).not.toContain("Choose");
    expect(mocks.availability).not.toHaveBeenCalled();
  });
  it.each(betaIds)("gates %s availability without blocking entry on a resume lookup", async certId => {
    mocks.findOpen.mockResolvedValue("resume");
    const page = await DiagnosticStartPage({ searchParams: Promise.resolve({ cert: certId, length: "10" }) });
    expect(mocks.availability).toHaveBeenCalledWith(certId);
    expect(mocks.findOpen).not.toHaveBeenCalled();
    expect(page.props).toMatchObject({ certId, initialCount: 10 });
    expect(page.props.resumeId).toBeUndefined();
    expect(page.props.children).toBeUndefined();
  });
  it.each(["20", "500", "invalid"])("does not offer unsupported beta length %s", async length => {
    const page = await DiagnosticStartPage({ searchParams: Promise.resolve({ cert: "data-engineer", length }) });
    expect(page.props.initialCount).toBe(5);
  });
  it("shows the waitlist for a known coming-soon certification instead of a 404", async () => {
    mocks.availability.mockResolvedValue("coming-soon");
    const page = await DiagnosticStartPage({ searchParams: Promise.resolve({ cert: "cloud-architect" }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("diagnostic is coming soon");
    expect(html).toContain("Get notified");
    expect(mocks.findOpen).not.toHaveBeenCalled();
  });
  it.each(["not-a-cert", "", ["data-engineer", "cloud-architect"]])("rejects invalid or ambiguous cert %j", async cert => {
    await expect(DiagnosticStartPage({ searchParams: Promise.resolve({ cert }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.findOpen).not.toHaveBeenCalled();
  });
  it.each([undefined, PMLE_CERT_ID])("preserves PMLE default and longer selection (%s)", async cert => {
    const page = await DiagnosticStartPage({ searchParams: Promise.resolve({ cert, length: "20" }) });
    expect(mocks.availability).toHaveBeenCalledWith(PMLE_CERT_ID);
    expect(mocks.findOpen).not.toHaveBeenCalled();
    expect(page.props.initialCount).toBe(20);
    expect(renderToStaticMarkup(page)).toContain("What the PMLE diagnostic covers");
  });
});

it("normalizes cert case and permits autostart only for one explicit start=1", async () => {
  const page = await DiagnosticStartPage({ searchParams: Promise.resolve({ cert: "DATA-ENGINEER", start: "1" }) });
  expect(page.props).toMatchObject({ certId: "data-engineer", autoStart: true });
  const ambiguous = await DiagnosticStartPage({ searchParams: Promise.resolve({ start: ["1", "1"] }) });
  expect(ambiguous.props.autoStart).toBe(false);
  const metadata = await generateMetadata({ searchParams: Promise.resolve({ cert: "DATA-ENGINEER" }) });
  expect(metadata.alternates?.canonical).toBe("https://testero.ai/diagnostic?cert=data-engineer");
});

it.each(["cloud-architect", "cloud-developer"])("does not advertise an open beta in metadata for closed %s", async cert => {
  mocks.availability.mockResolvedValue("coming-soon");
  const metadata = await generateMetadata({ searchParams: Promise.resolve({ cert }) });
  expect(metadata.title).toContain("diagnostic coming soon");
  expect(metadata.description).toContain("Get notified");
  expect(metadata.description).not.toContain("Choose");
  expect(metadata.openGraph?.title).toContain("coming soon");
});
