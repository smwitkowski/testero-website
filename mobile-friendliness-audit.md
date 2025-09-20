# Mobile Friendliness Audit – testero.ai

## 1. Executive Summary
- The marketing and conversion journeys render with responsive breakpoints, but several mobile-only issues remain—particularly around zoom accessibility, tap sizing, and scaling effects that introduce layout drift.
- Major mobile risks include (a) global zoom being disabled, which blocks pinch-to-zoom for low-vision users; (b) primary form inputs stuck at a 36 px height, creating undersized tap targets; and (c) the “Most Popular” pricing card scaling beyond the viewport, which can cause horizontal scrolling or clipped content.
- Top urgent changes: restore viewport scaling, allow form inputs to reach at least 44 px height, and remove/condition the pricing-card `scale-105` transform on small screens.

## 2. Audit Methodology
- Reviewed shared layout and SEO configuration (`app/layout.tsx`, `lib/seo/seo.ts`) to understand global head tags, viewport rules, and navigation placement.
- Inspected hero, CTA, and testimonial sections in `app/page.tsx`, alongside reusable marketing components (lamp effect, carousel, social proof) to trace Tailwind breakpoints and animation behavior.
- Assessed pricing flows by reading `app/pricing/page.tsx` and the supporting `PricingCard` and `ComparisonTable` components for stacking logic, typography, and plan toggles.
- Evaluated forms via `components/ui/input.tsx`, `components/marketing/forms/waitlist-form.tsx`, and `components/auth/auth-form-field.tsx` to verify input ergonomics, labels, and field states on narrow viewports.
- Without live rendering, assumed Tailwind classes render as defined and that transforms, spacing, and typography apply at the documented breakpoints.

## 3. Findings (Detailed, Code-Referenced)

### F1 – Viewport blocks pinch-to-zoom
- **Code Reference:** `lib/seo/seo.ts`, lines 135-140.
- **Issue Description:** Setting `maximumScale: 1` prevents mobile users from zooming, hindering accessibility for low-vision visitors.
- **Severity:** High
- **Recommendation:** Allow user scaling by omitting `maximumScale` or setting it above `1`.
  ```ts
  export function generateViewport(): Viewport {
    return {
      width: "device-width",
      initialScale: 1,
      // Remove maximumScale to allow pinch zoom
    };
  }
  ```

### F2 – Form inputs capped at 36 px height
- **Code Reference:** `components/ui/input.tsx`, lines 5-14; `components/marketing/forms/waitlist-form.tsx`, lines 127-157.
- **Issue Description:** The base `Input` sets `h-9`, so even when higher padding is applied, inputs remain ~36 px tall—below Apple/Google’s 44 px recommendation, making tap targets cramped on phones.
- **Severity:** High
- **Recommendation:** Replace `h-9` with `min-h-[44px]` (or expose a size prop) so mobile forms reach comfortable heights.
  ```tsx
  className={cn(
    "file:text-foreground ... min-h-[44px] w-full rounded-md border px-3 py-3 text-base ...",
    className
  )}
  ```

### F3 – Mobile nav links lack tappable area
- **Code Reference:** `components/marketing/navigation/navbar.tsx`, lines 165-176.
- **Issue Description:** Each mobile menu `Link` renders as inline text without vertical padding or `block` display, so the tap target is only the glyph area, which is easy to miss on touch devices.
- **Severity:** Medium
- **Recommendation:** Apply `block py-3` (≈48 px) and `px` padding to each link when the mobile menu is open.

### F4 – “Most Popular” pricing card overflows on small screens
- **Code Reference:** `components/pricing/PricingCard.tsx`, lines 41-48.
- **Issue Description:** Applying `scale-105` to the recommended tier enlarges the card even on `grid-cols-1`, leading to horizontal overflow or clipped shadows on ≤640 px viewports.
- **Severity:** High
- **Recommendation:** Limit the scale-up to medium screens and above, or swap for a border/color treatment.
  ```tsx
  tier.recommended
    ? "border-blue-500 md:scale-105 shadow-xl"
    : "border-gray-200 ..."
  ```

### F5 – Carousel pagination dots unusably small
- **Code Reference:** `components/marketing/sections/testimonial-carousel.tsx`, lines 94-108.
- **Issue Description:** Navigation buttons are `w-3 h-3` (~12 px), far under the recommended 44 px, making manual slide selection nearly impossible on touchscreens.
- **Severity:** Medium
- **Recommendation:** Increase size/padding (e.g., wrap dots in a 44 px button with a centered 12 px indicator).

### F6 – Waitlist & auth fields rely on placeholders instead of labels
- **Code Reference:** `components/marketing/forms/waitlist-form.tsx`, lines 127-158; `components/auth/auth-form-field.tsx`, lines 20-47.
- **Issue Description:** Inputs have no visible or aria-associated `<label>`, forcing mobile screen readers to rely on placeholder text that disappears on entry, reducing usability and accessibility.
- **Severity:** Medium
- **Recommendation:** Add `<FormLabel>` / `<label htmlFor>` elements (visually hidden if necessary) and associate them via `id` to keep context when typing.

### F7 – Pricing comparison booleans lack accessible text & labels are tiny
- **Code Reference:** `components/pricing/ComparisonTable.tsx`, lines 24-34 and 140-153.
- **Issue Description:** Boolean cells render bare `<Check>`/`<X>` icons with no `aria-hidden` or sr-only text, so mobile screen readers may announce “icon” without context. In the mobile layout, plan headings use `text-xs` (~12 px), which is hard to read on high-density displays.
- **Severity:** Medium
- **Recommendation:** Wrap icons with descriptive sr-only text (e.g., “Included” / “Not included”) and bump plan labels to at least `text-sm`.

## 4. Thematic Grouping
- **Typography & Layout:** F4, F7 – overflow on pricing card, undersized comparison labels.
- **Navigation & Headers:** F3 – mobile nav link tap sizing.
- **CTA Buttons & Tap Targets:** F2, F5 – undersized form fields and carousel controls.
- **Forms:** F2, F6 – input height and missing labels on waitlist/auth flows.
- **Pricing Tables:** F4, F7 – scaling overflow and inaccessible comparison states.
- **Performance & Assets:** F1 – viewport scaling restriction impacting accessibility.

## 5. Prioritized Backlog
- **P1 (Critical)**
  - F1 Restore viewport zoom support.
  - F2 Update input sizing to meet 44 px tap minimum.
  - F4 Constrain pricing card scaling on mobile.
- **P2 (Important)**
  - F3 Expand mobile nav link tap targets.
  - F5 Resize testimonial carousel controls.
  - F6 Add explicit labels to waitlist/auth forms.
  - F7 Improve pricing comparison accessibility and typography.
- **P3 (Nice-to-have)**
  - _None identified._

## 6. Suggested PR/Ticket Titles
- Allow user zoom by removing maximumScale from viewport config.
- Raise shared input min-height to 44 px and expose size variants.
- Limit pricing card scale-up effect to ≥md breakpoints.
- Give mobile menu links full-width 48 px tap targets.
- Add labels and accessible status text to waitlist/auth forms and pricing comparison.
