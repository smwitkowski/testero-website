import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { DiagnosticStart } from "@/components/diagnostic-start";
import DiagnosticStartPage from "@/app/diagnostic/page";
import { Button } from "@/components/ui/button";

// Small hook driver: requests deliberately ignore AbortSignal so stale-result guards
// are tested independently of the browser's best-effort cancellation.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], index: 0, effects: [] as (() => void | (() => void))[] }));
const mocks = vi.hoisted(() => ({ request: vi.fn(), track: vi.fn(), findOpen: vi.fn(), credentials: vi.fn(), availability: vi.fn(), pathname: "/diagnostic" }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const slot = hooks.index++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = initial;
    return [hooks.slots[slot], (next: unknown) => { hooks.slots[slot] = typeof next === "function" ? next(hooks.slots[slot]) : next; }];
  },
  useRef: (initial: unknown) => {
    const slot = hooks.index++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = { current: initial };
    return hooks.slots[slot];
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const slot = hooks.index++;
    const previous = hooks.slots[slot] as unknown[] | undefined;
    if (!previous || deps.some((dep, index) => dep !== previous[index])) hooks.effects.push(effect);
    hooks.slots[slot] = deps;
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname, notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/components/diagnostic-session", () => ({ DiagnosticSession: () => null }));
vi.mock("@/components/diagnostic-resource", () => ({ diagnosticRequest: mocks.request, requestError: () => "Unavailable" }));
vi.mock("@/lib/analytics/client", () => ({ trackDiagnostic: mocks.track }));
vi.mock("@/lib/diagnostic/service", () => ({ findOpenDiagnostic: mocks.findOpen }));
vi.mock("@/lib/diagnostic/request", () => ({ diagnosticCredentials: mocks.credentials }));
vi.mock("@/lib/certifications/availability", () => ({ getDiagnosticAvailability: mocks.availability }));

function nodes(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...nodes(element.props.children)];
}
function render(props: Parameters<typeof DiagnosticStart>[0] = {}) {
  hooks.index = 0;
  const result = DiagnosticStart(props);
  const effects = hooks.effects.splice(0);
  for (const effect of effects) effect();
  return result;
}
function button(tree: ReactElement, text: string) {
  return nodes(tree).find(node => node.type === Button && node.props.children === text)!;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const created = { sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", href: "/diagnostic/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", progress: {} };
beforeEach(() => {
  hooks.slots = []; hooks.effects = []; hooks.index = 0;
  mocks.request.mockReset(); mocks.track.mockReset(); mocks.findOpen.mockReset(); mocks.credentials.mockReset();
  mocks.availability.mockResolvedValue("available"); mocks.pathname = "/diagnostic";
  const events = new EventTarget();
  vi.stubGlobal("window", { location: { search: "" }, history: { replaceState: vi.fn(), pushState: vi.fn() }, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events) });
});
afterEach(() => vi.unstubAllGlobals());

it("renders the entry without awaiting any owner or saved-session lookup", async () => {
  mocks.findOpen.mockReturnValue(new Promise(() => {}));
  const page = await DiagnosticStartPage({ searchParams: Promise.resolve({ length: "5", src: "ad" }) });
  expect(page.props).toMatchObject({ initialCount: 5, paidLanding: true, autoStart: false });
  expect(mocks.findOpen).not.toHaveBeenCalled();
  expect(mocks.credentials).not.toHaveBeenCalled();
});

it("keeps the CTA enabled during lookup and starts once without waiting", async () => {
  const lookup = deferred<{ resumeId: string | null }>();
  const post = deferred<typeof created>();
  mocks.request.mockImplementation((_url, options) => options.method === "POST" ? post.promise : lookup.promise);
  const cta = button(render(), "Start the 5-question check");
  expect(cta.props.disabled).toBe(false);
  const start = cta.props.onClick as () => Promise<void>;
  const starting = start();
  await start();
  expect(mocks.request.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
  post.resolve(created); await starting;
  lookup.resolve({ resumeId: "stale-session" }); await lookup.promise;
  const restored = render();
  expect(nodes(restored).find(node => node.props.href === `/diagnostic/${created.sessionId}`)).toBeDefined();
  expect(nodes(restored).find(node => node.props.href === "/diagnostic/stale-session")).toBeUndefined();
  expect(mocks.track).toHaveBeenCalledOnce();
});

it("keeps manual start available if lookup fails, without unsafe automatic start", async () => {
  const lookup = deferred<{ resumeId: string | null }>();
  window.location.search = "?start=1&length=5";
  mocks.request.mockImplementation((_url, options) => options.method === "POST" ? Promise.resolve(created) : lookup.promise);
  render({ autoStart: true });
  lookup.reject(new Error("Unavailable")); await lookup.promise.catch(() => {});
  const tree = render({ autoStart: true });
  expect(mocks.request.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(0);
  const cta = button(tree, "Start the 5-question check");
  expect(cta.props.disabled).toBe(false);
  await (cta.props.onClick as () => Promise<void>)();
  expect(mocks.track).toHaveBeenCalledOnce();
});

it("offers a returning owner's unfinished session instead of autostarting", async () => {
  const lookup = deferred<{ resumeId: string | null }>();
  window.location.search = "?start=1&length=5";
  mocks.request.mockReturnValue(lookup.promise);
  render({ autoStart: true });
  lookup.resolve({ resumeId: "saved-session" }); await lookup.promise;
  const tree = render({ autoStart: true });
  expect(nodes(tree).find(node => node.props.href === "/diagnostic/saved-session")).toBeDefined();
  expect(button(tree, "Start a new 5-question check").props.disabled).toBe(false);
  expect(mocks.request.mock.calls.every(([, options]) => options.method !== "POST")).toBe(true);
});

it("ignores an older pageshow lookup even if it resolves after the fresh lookup", async () => {
  const old = deferred<{ resumeId: string | null }>();
  const fresh = deferred<{ resumeId: string | null }>();
  mocks.request.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  render();
  window.dispatchEvent(new Event("pageshow"));
  fresh.resolve({ resumeId: "fresh-session" }); await fresh.promise;
  old.resolve({ resumeId: "old-session" }); await old.promise;
  const tree = render();
  expect(nodes(tree).find(node => node.props.href === "/diagnostic/fresh-session")).toBeDefined();
  expect(nodes(tree).find(node => node.props.href === "/diagnostic/old-session")).toBeUndefined();
});
