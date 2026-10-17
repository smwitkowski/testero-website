# Blog/FAQ QA — D-031 (2026-10-13)

## Scope and assumptions

Keep all 14 existing article URLs for search traffic. Missing catalog `exam`
metadata means Professional Machine Learning Engineer (PMLE); nine explicitly
named non-PMLE subjects get notices and index tags. “Coming soon” follows D-031
and is not a launch-date commitment. Data Analytics is labeled Google Data
Analytics Professional Certificate, not a Google Cloud exam.

The historical October 2024 PMLE article uses its existing SHA-256-locked
publication overlay; original Markdown is unchanged. `original-hashes.json`
records all 14 original blog/FAQ files. No `hq/drafts` material is published.

## Implementation

- One catalog field, loader field, and small shared notice/tag components.
- Homepage “Before you get started” uses the two PMLE FAQs only.
- Article/index typography uses existing Tailwind tokens and system fonts.
- Dark semantic colors are scoped by `.certification-content` to blog/FAQ roots,
  including their shared header/footer. Product pages retain the current palette.
- Markdown code scrolls, images fit, nested lists/quotes keep spacing, and tables
  have focusable labeled scroll containers. Tables use a 36rem minimum width to
  avoid unreadable single-letter mobile columns. Reading width remains 44rem.
- Historical PMLE guidance now directs readers to the current official guide,
  rather than presenting old topic/tool lists as today's blueprint.

## Verification

Local evidence directory:
`/Users/switkowski/Projects/Testero/hq/drafts/blog-qa-2026-10-13/`.

- 16 content routes × 1280px/375px × light/dark = 64 captures per stage.
- Before and after: all 200; no document horizontal overflow or internal 404s.
- After: one main H1, title/description/canonical present, no browser page errors,
  no broken images. All 22 distinct internal crawl targets return 200.
- Nine non-PMLE article notices appear above body content (36 cases). PMLE
  articles have no unsupported-exam notice. Indexes have 2/7 tags respectively.
- Inspected desktop/mobile light/dark contact sheets for all routes.
- Supplemental native-rendered Markdown fixture exercises lists, quotes, inline
  and block code, wide tables, and local images absent from published overlays.
  Four fixture captures fit the viewport; the mobile 576px table scrolls inside
  its 335px container. Temporary test/image/script removed from the repository.
- Homepage, login, diagnostic, and pricing checked at both widths/color schemes:
  all 200, no overflow, and no certification dark theme outside content routes.
- Clean environment gates: 812 tests (42 files), lint, typecheck, Docker build.
- Read-only second review found no blocking content/notice bug; its site-wide
  theme concern was resolved by scoping colors and checking the four public pages.

This is local browser/build evidence, not live Stripe/cloud or factual validation
of every external citation. Existing payment/auth behavior was not changed.

### Repeat the route capture and internal crawl

Start local Supabase and the app with the documented `scripts/local.mjs dev`
workflow, then run:

```sh
node scripts/blog-qa.mjs after /absolute/path/to/qa-output
```

The script captures screenshots and writes `after.json`. It fails on HTTP/layout,
metadata, image, browser error, or internal crawl errors. Existing Playwright is
used; no new runtime dependency is added.

### Representative before/after pairs

Under the evidence directory above (all also captured at the other sizes/themes):

- `/blog`: `before-blog-1280-light.png`, `after-blog-1280-light.png`
- `/blog/pmle-october-2024-exam-changes`:
  `before-blog--pmle-october-2024-exam-changes-375-dark.png`,
  `after-blog--pmle-october-2024-exam-changes-375-dark.png`
- `/faq/what-are-the-five-sections-of-the-associate-cloud-engineer-certification-by-google`:
  `before-faq--what-are-the-five-sections-of-the-associate-cloud-engineer-certification-by-google-375-light.png`,
  `after-faq--what-are-the-five-sections-of-the-associate-cloud-engineer-certification-by-google-375-light.png`

## Separate content follow-ups (not added to this PR)

The read-only audit identified historical FAQ details that need current official
sources: registration-provider steps, certification renewal periods, Cloud
Digital Leader fee, ACE domains, Data Analytics course/workload details, and
remaining employer-value generalizations. Data Analytics links currently fall
back to the Google Cloud directory; a subject-specific citation review would
be useful. Old AutoML Tables examples in the architecture article also need a
separate overlay refresh. External citation health was not verified here.
