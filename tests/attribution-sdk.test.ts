import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";

// Execute the installed pinned SDK, not a mock of its campaign parsing logic.
// The browser globals must exist before loading its CommonJS modules.
const requireSdk = createRequire(import.meta.url);
afterEach(() => vi.unstubAllGlobals());
it("pinned PostHog derives UTMs/gclid for current events, session entry, and initial person properties", () => {
  const first = { utm_source: "google", utm_medium: "cpc", utm_campaign: "pmle", utm_content: "five", gclid: "Click_123" };
  const location = { href: `https://testero.ai/diagnostic?${new URLSearchParams(first)}` };
  const document = { URL: location.href, referrer: "https://www.google.com/", cookie: "", location, addEventListener: vi.fn(), removeEventListener: vi.fn(), createElement: () => new URL("https://testero.ai/") };
  vi.stubGlobal("window", { location, addEventListener: vi.fn(), removeEventListener: vi.fn() }); vi.stubGlobal("location", location); vi.stubGlobal("document", document);
  const sdkRoot = dirname(requireSdk.resolve("posthog-js/package.json"));
  expect(JSON.parse(readFileSync(resolve(sdkRoot, "package.json"), "utf8")).version).toBe("1.435.8");
  const { PostHogPersistence } = requireSdk(resolve(sdkRoot, "lib/src/posthog-persistence.js")) as typeof import("posthog-js/lib/src/posthog-persistence");
  const { SessionPropsManager } = requireSdk(resolve(sdkRoot, "lib/src/session-props.js")) as typeof import("posthog-js/lib/src/session-props");
  const { PostHog, defaultConfig } = requireSdk(resolve(sdkRoot, "lib/src/posthog-core.js")) as typeof import("posthog-js/lib/src/posthog-core");
  const config = defaultConfig();
  expect(config.save_campaign_params).toBe(true);
  expect(config.mask_personal_data_properties).toBe(false); // gclid is not masked by this app's config.
  // Use the real persistence methods with memory transport only; no browser, storage or network required.
  const persistence = new PostHogPersistence({ ...config, persistence: "memory", token: "unit" });
  persistence.set_initial_person_info();
  const sessionPersistence = new PostHogPersistence({ ...config, persistence: "memory", token: "unit-session" });
  sessionPersistence.update_campaign_params();
  expect(sessionPersistence.properties()).toMatchObject(first);
  const initial = persistence.get_initial_props();
  for (const [key, value] of Object.entries(first)) expect(initial[`$initial_${key}`]).toBe(value);
  let sessionChanged!: (id: string) => void;
  const instance = { config };
  const sessionManager = { onSessionId: (callback: (id: string) => void) => { sessionChanged = callback; callback("first-session"); } };
  const sessionProps = new SessionPropsManager(instance as never, sessionManager as never, persistence);
  for (const [key, value] of Object.entries(first)) expect(sessionProps.getSessionProps()[`$session_entry_${key}`]).toBe(value);
  // A later campaign updates event campaign fields but neither initial person nor session entry.
  location.href = "https://testero.ai/diagnostic?utm_source=reddit&gclid=LaterClick"; document.URL = location.href;
  sessionPersistence.update_campaign_params(); persistence.set_initial_person_info();
  expect(sessionPersistence.properties()).toMatchObject({ utm_source: "reddit", gclid: "LaterClick" });
  expect(persistence.get_initial_props().$initial_gclid).toBe("Click_123");
  expect(sessionProps.getSessionProps().$session_entry_gclid).toBe("Click_123");
  sessionChanged("next-session");
  expect(sessionProps.getSessionProps()).toMatchObject({ $session_entry_utm_source: "reddit", $session_entry_gclid: "LaterClick" });
  // Native person processing is deferred until identify for identified_only.
  const calculated = PostHog.prototype as unknown as { _calculate_set_once_properties: (this: unknown, props?: object, mark?: boolean, force?: boolean) => Record<string, unknown> | undefined };
  const personState = { persistence, sessionPropsManager: sessionProps, config, _hasPersonProcessing: () => false, _personProcessingSetOncePropertiesSent: false };
  expect(calculated._calculate_set_once_properties.call(personState)).toBeUndefined();
  personState._hasPersonProcessing = () => true;
  const identified = calculated._calculate_set_once_properties.call(personState, {}, true, true);
  expect(identified).toMatchObject({ $initial_utm_source: "google", $initial_gclid: "Click_123", utm_source: "reddit", gclid: "LaterClick" });
  persistence.destroy(); sessionPersistence.destroy();
});
