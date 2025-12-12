# Implementation Request: Testero Hero Section (Homepage)

*Reference: final hero mock image*

This request describes the implementation of the new Testero hero section. The goal is to match the design **pixel-close** while keeping the code clean, responsive, and ready for future iteration.

---

## 1. Overview

Implement the **homepage hero section** exactly as shown in the attached mock.

**Primary Goals:**
- Communicate value above the fold
- Strong diagnostic-first CTA
- Clean, professional aesthetic
- Responsive layout that preserves design intent
- Reusable components for future sections

**Business Context:**
- This is a **diagnostic-first** conversion tool
- Primary CTA should drive users to `/diagnostic`
- Secondary CTA can link to example questions or pricing
- Measure conversion rate: diagnostic starts from hero CTA

---

## 2. Component Architecture

### File Structure

Create the hero section as a standalone component following our marketing component patterns:

```
components/marketing/sections/
└── hero-section.tsx          # Main hero component
```

### Component Pattern

Follow the same pattern as `benefits-section.tsx`:
- TypeScript with explicit prop interfaces
- Tailwind CSS utility classes only (no inline styles)
- Export component and any related types
- Use existing Button component from `@/components/ui/button`
- Use existing design tokens where applicable

### Integration Point

Replace the current `LampContainer` hero in `app/page.tsx` (lines 84-167) with the new `<HeroSection />` component.

---

## 3. Layout Requirements

### Structure

- **Two-column layout:**
  - **Left column:** text content, CTAs, microcopy
  - **Right column:** layered product mock cards
- Constrain hero container to `max-w-7xl` (matches our existing pattern)
- Center content horizontally with `mx-auto`
- Top padding: `pt-24` (96px) - use Tailwind spacing tokens
- Horizontal gap between columns: `gap-12` to `gap-16` (48-64px)
- Vertical spacing: Use Tailwind spacing scale (`space-y-4`, `space-y-6`, etc.)

### Responsiveness

- **Desktop (≥1024px):** Two-column layout with `grid-cols-2`, layered cards on right
- **Tablet (768-1023px):** Stack vertically with `flex-col`, mock centered under text
- **Mobile (≤767px):**
  - Text center-aligned with `text-center`
  - Product mock becomes single centered image
  - CTAs stacked vertically with `flex-col gap-4`
  - Spacing tightened but not collapsed

---

## 4. Typography

Use **Inter** font family (already configured in the project).

### Sizes & Weights

- **Eyebrow label:** `text-xs` or `text-sm`, `font-medium`, `tracking-wide`
- **H1:** `text-4xl md:text-5xl lg:text-6xl`, `font-bold` (700), `leading-tight`
- **Body text:** `text-base md:text-lg`, `font-normal` (400) or `font-medium` (500)
- **CTA button:** `font-semibold` (600)
- **Microcopy:** `text-sm`, `text-muted-foreground`

### Colors (Use Design Tokens)

- **Heavy text:** `text-foreground` or `text-slate-900`
- **Secondary text:** `text-muted-foreground` or `text-slate-600`
- **Microcopy:** `text-slate-500` or `text-muted-foreground`

---

## 5. Content (Literal Text)

**Do not alter text without checking back with us.**

### Eyebrow:
```
AI-POWERED CERTIFICATION READINESS
```

### Headline:
```
Know if you're ready before you book your exam.
```

### Subheadline:
```
Testero uses realistic, blueprint-aligned questions to benchmark your readiness and show exactly where to focus.
```

### Primary CTA:
```
Start free readiness check
```

### Secondary CTA (text link):
```
View example questions
```

### Microcopy:
```
Takes 5–7 minutes · No credit card required
```

---

## 6. CTA Button Requirements

### Primary CTA Button

Use our existing `Button` component from `@/components/ui/button`:

```tsx
<Button
  asChild
  size="lg"
  tone="accent"
  variant="solid"
  className="w-full sm:w-auto"
>
  <Link href="/diagnostic">Start free readiness check</Link>
</Button>
```

**Styling:**
- Size: `lg` (already configured in Button component)
- Tone: `accent` (uses our design system blue gradient)
- Hover: Handled by Button component (slightly darker, soft elevation)
- Active: Handled by Button component
- Rounded corners: Already configured in Button (8-12px)
- Full width on mobile: `w-full sm:w-auto`

### Secondary CTA

Use a simple text link with hover underline:

```tsx
<Link
  href="/practice"
  className="text-blue-600 hover:text-blue-700 hover:underline font-semibold"
>
  View example questions
</Link>
```

---

## 7. Product Mock Implementation

We **do not** need real components; these can be static assets or lightweight markup.

### Requirements

#### A. Readiness Dashboard Card

- Card container: `rounded-xl` or `rounded-2xl` (12-16px)
- Border: `border border-slate-200` or `border-slate-300`
- Shadow: `shadow-lg` or `shadow-xl`
- Background: `bg-white`
- Elements included:
  - Circular readiness score (78%) - use SVG or CSS
  - Domain Breakdown list - simple list with Tailwind styling
  - Light-blue highlight on one selected domain - `bg-blue-50` or `bg-blue-100`

Use vector-based assets (SVG) if possible for crisp scaling.

#### B. Example Question Card

- Slight overlap with dashboard card using `absolute` positioning
- Z-index: `z-10` above dashboard (`z-0`)
- Checkbox styles: Use Tailwind checkbox utilities or custom styled checkboxes
- "Explanation" button: Use our Button component with `variant="outline"` and `tone="neutral"`

### Layering / Positioning

- Implement via `relative` container on right column
- Use `absolute` positioning for overlapping cards
- Maintain responsiveness:
  - On tablet: Cards reduce size proportionally
  - On mobile: Cards collapse into one centered static image or simplified layout

---

## 8. Background & Section Styling

### Background

- Very light neutral: `bg-slate-50` or `bg-white`
- Right-side subtle background block: Use CSS with `bg-slate-100` or `bg-slate-200`
- Rounded corner: `rounded-l-3xl` or similar on one side
- Position: Absolute positioned behind product mock

### Implementation

Use Tailwind classes only:
```tsx
<section className="w-full bg-slate-50 py-24">
  {/* Content */}
</section>
```

---

## 9. Navigation Alignment

Ensure nav bar matches mock styling:

- Right-side "Start Free" button: Use Button with `variant="outline"` and `tone="accent"`
- Slightly rounded borders: Already handled by Button component
- Text color: Primary blue (handled by `tone="accent"`)
- Hover: Soft background tint (handled by Button component)

Nav should sit on transparent or very light background (already implemented in `navbar.tsx`).

---

## 10. Accessibility Requirements

- All buttons must be keyboard accessible (handled by Button component)
- Text-to-background contrast ratio ≥ 4.5:1 (verify with Tailwind color tokens)
- Add alt text for product mock region:
  ```tsx
  <div role="img" aria-label="Readiness dashboard and example exam question preview showing Testero's question format.">
    {/* Product mock */}
  </div>
  ```
- Semantic HTML: Use `<section>`, `<h1>`, `<p>` tags appropriately
- ARIA labels on CTAs: Already handled by Button component with `aria-label` prop

---

## 11. Performance Requirements

- Avoid large PNG screenshots; use SVGs or WebP if possible
- Lazy-load mock images if using `<Image>` component from Next.js
- Minimize layout shift: Reserve image space with `aspect-ratio` utilities
- Use Next.js `Image` component if using actual images (optimization built-in)

---

## 12. Code Implementation Notes

### Component Structure

```tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  // Add props if needed for future flexibility
}

export const HeroSection: React.FC<HeroSectionProps> = () => {
  return (
    <section className="w-full bg-slate-50 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left column: Text content */}
          <div className="space-y-6">
            {/* Eyebrow, Headline, Subheadline, CTAs, Microcopy */}
          </div>
          
          {/* Right column: Product mock */}
          <div className="relative">
            {/* Layered cards */}
          </div>
        </div>
      </div>
    </section>
  );
};
```

### Text Content Management

All text should live in a config object for easy marketing updates:

```tsx
const heroContent = {
  eyebrow: "AI-POWERED CERTIFICATION READINESS",
  headline: "Know if you're ready before you book your exam.",
  subheadline: "Testero uses realistic, blueprint-aligned questions to benchmark your readiness and show exactly where to focus.",
  primaryCta: {
    text: "Start free readiness check",
    href: "/diagnostic",
  },
  secondaryCta: {
    text: "View example questions",
    href: "/practice",
  },
  microcopy: "Takes 5–7 minutes · No credit card required",
};
```

### Product Mock Cards

If creating as components (not images), structure them as:

```tsx
// components/marketing/sections/hero-section.tsx

const ReadinessDashboardCard = () => (
  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
    {/* Dashboard content */}
  </div>
);

const ExampleQuestionCard = () => (
  <div className="absolute top-8 left-8 rounded-xl border border-slate-200 bg-white p-6 shadow-xl z-10">
    {/* Question content */}
  </div>
);
```

---

## 13. Acceptance Criteria

- [ ] Desktop view matches design within reasonable pixel tolerance
- [ ] Text hierarchy & contrast match design
- [ ] CTA button states implemented (using our Button component)
- [ ] Right-side mock layered exactly as in reference
- [ ] Fully responsive down to 320px wide
- [ ] No layout shift above 50ms (use `aspect-ratio` utilities)
- [ ] Accessible (labels, alt text, tab order, contrast)
- [ ] Hero loads in under ~100ms on average connection
- [ ] Uses only Tailwind utility classes (no inline styles)
- [ ] Follows our component architecture patterns
- [ ] Integrates cleanly with existing `app/page.tsx`

---

## 14. Optional Enhancements (If Easy)

Only implement if trivial (< 30 minutes):

- Add subtle hover animation to product cards: `hover:-translate-y-1 transition-transform`
- Reduce opacity of right-side background block on scroll (requires intersection observer)
- Add fade-in on initial load: Use `animate-fade-in` if we have it, or simple opacity transition

**Note:** These are optional. Ship the core implementation first, measure conversion, then iterate.

---

## 15. Testing Checklist

Before marking complete:

- [ ] Test on Chrome, Firefox, Safari (webkit)
- [ ] Test responsive breakpoints: 320px, 768px, 1024px, 1280px
- [ ] Verify CTA links work correctly
- [ ] Check keyboard navigation (Tab through all interactive elements)
- [ ] Verify contrast ratios meet WCAG AA standards
- [ ] Test with browser zoom at 200%
- [ ] Verify no console errors
- [ ] Check Lighthouse score (aim for 90+ Performance)

---

## 16. Integration with Analytics

Add PostHog tracking to primary CTA:

```tsx
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";

const posthog = usePostHog();

<Button
  asChild
  onClick={() => {
    trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_STARTED, {
      source: "hero_cta",
      referrer: "homepage",
    });
  }}
>
  <Link href="/diagnostic">Start free readiness check</Link>
</Button>
```

---

## 17. Design Token Reference

Use existing design tokens from `lib/design-system` where applicable:

- Colors: `@/lib/design-system/tokens/colors`
- Spacing: `@/lib/design-system/tokens/spacing`
- Typography: `@/lib/design-system/tokens/typography`
- Effects: `@/lib/design-system/tokens/effects`

If a token doesn't exist, use Tailwind's default scale and note it for future design system expansion.

---

## Questions or Clarifications?

If anything is unclear:
1. Check existing marketing components for patterns
2. Reference `components/marketing/sections/benefits-section.tsx` for structure
3. Use `components/ui/button.tsx` as reference for button implementation
4. Follow Tailwind-first approach - no custom CSS unless absolutely necessary

**Priority:** High - This is the primary conversion point on the homepage.

**ICE Score Estimate:** Impact(8) × Confidence(9) × Effort(3) = **216** ✅ Build immediately


