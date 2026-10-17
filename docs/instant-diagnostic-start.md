# Instant diagnostic start

## Shipped behavior

Create POST returns actual committed progress with the database-generated item ID. A scoped postcommit items read uses the same strict display mapper as diagnostic reads and answers. Only the persisted session-item ID, ordinal, domain code, stem and option label/text are public; correctness, selected answers, explanations and owner hashes are excluded. The existing atomic creation RPC, ownership rules and cookie attributes are unchanged. A failed postcommit read returns503 without automatically creating another session. The cookie is still set only on a successful response, so a failed read can leave an unreachable anonymous session, as other postcommit route failures can; retry is explicit.

The start component renders the existing diagnostic session immediately from this response. Native `history.replaceState` updates the URL without a route/RSC request. Existing pathname-aware chrome hides the shared navigation/footer; start-only coverage content is removed. Direct session URLs still use server-rendered, verified progress. History restoration derives session identity from the URL and reloads owned progress if the start route tree is restored without local data. Back returns to the preceding page; forward, reload, answering, completion and Start over remain supported. No new app shell, cache or global state layer is added.

## Measured mirror results

142 ACTIVE questions; loopback Supabase; Chromium desktop1280/mobile375. Baseline3 warm UI starts per viewport; final5 warm starts per viewport, excluding each run's first compilation/warmup sample. Baseline records question DOM readiness; final records four radios and focused question heading, a slightly stricter endpoint. These are browser-clock measurements, not assertion retry time or physical paint.

| Warm p50 ms | Desktop before→after | Mobile before→after |
|---|---:|---:|
| Begin click→question DOM/focus |102.2→62.0|90.1→62.0|
| Response headers→question DOM/focus |58.5→11.0|53.8→10.4|

Final maximum click→focus66.6ms desktop/65.2ms mobile, all10 warm samples below300ms. Final JSON-consumed→focus p5010.8/10.2ms. Strict click≤fetch start≤headers≤JSON consumed≤focused question order is asserted. Begin issues no follow-up progress GET or RSC GET before focus. The local route overhead is not the reported production600ms; no production result is claimed.

## Smaller history query

Owner history now uses one left-embedded query over the newest50 diagnostic parent sessions instead of selecting session IDs then fetching items. Owner filters, ordering, parent limit, deduplication and best-effort failure behavior are preserved. Empty parents still count toward50; `!inner` is deliberately absent. No migration is needed.

An actual local database fixture with52 owned parents, one newer foreign parent, a newest empty parent and multiple items per nonempty parent returned exactly the same seen-question set as the old query. Oldest two and foreign questions were excluded. Fixture rows were deleted afterward. Five alternating direct-query samples: p508.09→4.32ms, two HTTP requests→one.

Controlled real production-mode route samples used five separate anonymous owners per arm, each seeded with three sessions containing the same20 question snapshots. One unmeasured create warmed the application first. Before→after Server-Timing p50: history8.6→5.7ms, inventory10.9→10.5ms, create RPC8.7→7.6ms, progress read4.8→4.2ms, total27.3→25.2ms. HTTP/body-consumed p5033.1→30.9ms. Other stage changes include run noise; do not attribute them all to history. Inventory remains parallel and can dominate the cold critical path.

## Cold investigation: rejected startup warmup

A bounded startup transport probe was tested, then omitted. It awaited one read-only `exam_domains` query before Next readiness, with a2000ms abort bound, retries disabled, build/runtime guards and fail-open behavior. It did not run during production builds. The same new application sources were built without/with the hook; five independent server processes per arm received a direct create POST as their first request, with no health/page warmup. The local database stayed running: these were fresh application-process samples, **not cold database samples**.

Without→with warmup p50: ready196.4→191.6ms; first POST339.9→355.3ms; request handler51.3→56.0ms. The probe itself took28ms p50. History15.5→8.8ms and inventory19.4→16.3ms changed, but RPC15.7→23.8ms also varied. There was no end-to-end gain, so no hook, startup request, timeout constant or keepalive mechanism ships. This does not identify DNS, TLS, pool or query-plan behavior as the production cause. The history query removes a real round trip, but does not establish a cure for the cold962ms inventory span.

## Production model and verification

Given the supplied warm trace805ms visible minus roughly600ms route transition, the model is approximately `205ms + added production progress-read latency + client/history/other deltas`. This is not a production prediction or a guaranteed≤300ms result. Production validation still needs create Server-Timing, body-consumed→focus and cold/idle samples. No synthetic local read latency is substituted for production latency.

Native mirrored QA passed10/10: free practice, account confirmation/claims, fake-Stripe paid/refund, full diagnostic, instant start budget, refresh, back/forward, SiteLogo navigation, and Start over. A final focused two-viewport run also passed strict timestamp ordering. Startup experiments and temporary fixture runners are not production code. No production writes, credentials, migrations, infrastructure changes or dependencies were added. Clean unit/lint/typecheck/Docker results are recorded in the PR.
