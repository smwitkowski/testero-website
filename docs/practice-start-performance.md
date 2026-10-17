# Fast diagnostic and practice start

## Scope
- One ACTIVE+GOOD bank inventory query instead of one availability and six serial domain queries. Blueprint distribution, freshness preference, answer shuffling unchanged.
- Owned, answer-key-free initial session progress server-rendered; no mount GET on success. Error paths retain existing saved-progress recovery.
- Safe practice progress prefetched only after committed answer while explanation is visible; generation guard rejects late requests after Next/retry. No explanations prefetched.
- Independent billing sources and explanation sources fetched concurrently. Fresh fail-closed access remains after committed practice answer; DB quota and idempotency unchanged.
- Development-only Supabase request durations, selector/create durations and one trivial query RTT. No query/body/credential logs. No infra changes.

Inventory reads use stable ID pagination at 1,000 rows to avoid silently sampling only the PostgREST first page; current bank remains one query.

## Evidence limitations
Local 30-question educational seed, Next development, loopback Supabase. First sample excluded as compilation. Baseline diagnostic POST warm p50 147.6ms(n5); after39.3ms(n7). ProgressGET32.7->20.3ms. After diagnostic answer p5024ms. API durations are not click-to-visible.

Separate browser profile (5 each, local confirmed paid fixture, dev, baseline restored after implementation run): baseline was exact `94424cb` content for all 12 implementation files, including both billing files. Implementation was subsequently committed as `6f46a67`. Same dev process, hot reload, no restart between these profiles. Source hashes are in the coordinator's `speed-timings.json`. No full bank digest was captured.

Browser measurements: diagnostic click-to-question visible p50 860.7→363.0ms; paid practice create 94.9→94.8ms (no material change); paid answer 117.5→104.5ms. All five samples included; dev HMR/order/noise limit causal interpretation. Before/after raw values are included below.

```json
{
  "before": [
    {
      "kind": "diagnostic-click-visible",
      "ms": 860.6629170000001
    },
    {
      "kind": "practice-create",
      "ms": 105.5238330000002
    },
    {
      "kind": "paid-answer",
      "ms": 131.31654200000003
    },
    {
      "kind": "diagnostic-click-visible",
      "ms": 857.3658750000004
    },
    {
      "kind": "practice-create",
      "ms": 95.84262500000023
    },
    {
      "kind": "paid-answer",
      "ms": 110.67483300000004
    },
    {
      "kind": "diagnostic-click-visible",
      "ms": 853.6447079999998
    },
    {
      "kind": "practice-create",
      "ms": 85.88345800000025
    },
    {
      "kind": "paid-answer",
      "ms": 124.62750000000051
    },
    {
      "kind": "diagnostic-click-visible",
      "ms": 861.1164589999998
    },
    {
      "kind": "practice-create",
      "ms": 94.88062499999978
    },
    {
      "kind": "paid-answer",
      "ms": 115.38245800000004
    },
    {
      "kind": "diagnostic-click-visible",
      "ms": 874.5319580000005
    },
    {
      "kind": "practice-create",
      "ms": 89.91012500000033
    },
    {
      "kind": "paid-answer",
      "ms": 117.51337500000045
    }
  ],
  "after": [
    {
      "kind": "diagnostic-click-visible",
      "ms": 360.626166
    },
    {
      "kind": "practice-create",
      "ms": 94.84800000000018
    },
    {
      "kind": "paid-answer",
      "ms": 110.07162500000004
    },
    {
      "kind": "diagnostic-click-visible",
      "ms": 355.72429200000033
    },
    {
      "kind": "practice-create",
      "ms": 103.36245899999994
    },
    {
      "kind": "paid-answer",
      "ms": 161.9575420000001
    },
    {
      "kind": "diagnostic-click-visible",
      "ms": 375.5165830000001
    },
    {
      "kind": "practice-create",
      "ms": 95.47204199999987
    },
    {
      "kind": "paid-answer",
      "ms": 101.47387499999968
    },
    {
      "kind": "diagnostic-click-visible",
      "ms": 363.007791
    },
    {
      "kind": "practice-create",
      "ms": 92.75675000000047
    },
    {
      "kind": "paid-answer",
      "ms": 104.4535420000002
    },
    {
      "kind": "diagnostic-click-visible",
      "ms": 861.2370000000001
    },
    {
      "kind": "practice-create",
      "ms": 92.96183399999973
    },
    {
      "kind": "paid-answer",
      "ms": 95.82079200000044
    }
  ]
}
```
Founder production baseline supplied3.2s first question /2.9s create. No production benchmark collected. <=1s target not claimed. Six eliminated serial requests at hypothetical100–300ms RTT save600–1800ms; this is an estimate, not a measurement. Cloud Run is `us-central1` (founder supplied); Supabase region is unknown. Cross-region latency was not measured. Compare configured regions and co-locate only with approval if measured RTT is high.

A separate mirrored-bank run on `ee99337` (142 ACTIVE questions, Next dev, local loopback Supabase) recorded actual application trivial-query RTT of **27ms and 7ms**, from separate development module contexts. These are local observations, not Cloud Run→Supabase RTT. Five warm browser samples (sample 0 excluded) gave p50 diagnostic click-visible **342.2ms**, paid practice creation **99.2ms**, paid answer-visible **213.2ms**, and Next-visible **199.7ms**. Concurrent QA Docker/static load may overlap; there is no controlled mirrored-bank before/after comparison. Production targets remain unproved. Raw samples are in the coordinator's `speed-mirror-timings.json`.

## Gates
1034 unit tests, lint, typecheck passed (including inventory pagination). Docker passed. Local DB verifier passed. Diagnostic/accounts-practice e2e passed2 (SSR/no initial browserGET, delayed stale-prefetch regression). Initial harness failure route already handled corrected by not removing an outstanding route. DB verifier and these flow tests overlapped; both passed, but this is not clean sequential evidence. Final pagination change is unit-tested; subsequent mirror flow verification belongs to QA.
