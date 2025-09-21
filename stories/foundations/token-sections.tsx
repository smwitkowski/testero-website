import type { FC } from 'react';

import { primitive as spacingScale } from '@/lib/design-system/tokens/spacing';
import { primitive as typographyScale } from '@/lib/design-system/tokens/typography';

type ColorToken = {
  name: string;
  surface: string;
  foreground: string;
  description: string;
};

type RadiusToken = {
  name: string;
  className: string;
};

const colorTokens: ColorToken[] = [
  {
    name: 'Background & Foreground',
    surface: 'background',
    foreground: 'foreground',
    description: 'Primary application canvas with the default text color.',
  },
  {
    name: 'Card',
    surface: 'card',
    foreground: 'card-foreground',
    description: 'Surfaces for panels and cards sitting on the base canvas.',
  },
  {
    name: 'Muted',
    surface: 'muted',
    foreground: 'muted-foreground',
    description: 'Subtle backgrounds such as table headers or info banners.',
  },
  {
    name: 'Accent',
    surface: 'accent',
    foreground: 'accent-foreground',
    description: 'Highlighted UI elements such as badges, toggles, or focus states.',
  },
  {
    name: 'Primary',
    surface: 'primary',
    foreground: 'primary-foreground',
    description: 'Brand-driven call-to-action moments across the product.',
  },
  {
    name: 'Destructive',
    surface: 'destructive',
    foreground: 'destructive-foreground',
    description: 'Critical actions that communicate destructive intent.',
  },
];

const spacingEntries = Object.entries(spacingScale)
  .filter(([token]) => Number(token) <= 24)
  .map(([token, value]) => ({ token, value }));

const fontSizeEntries = Object.entries(typographyScale.fontSize);

const radiusTokens: RadiusToken[] = [
  { name: '--radius-sm', className: 'rounded-[var(--radius-sm)]' },
  { name: '--radius-md', className: 'rounded-[var(--radius-md)]' },
  { name: '--radius-lg', className: 'rounded-[var(--radius-lg)]' },
  { name: '--radius', className: 'rounded-[var(--radius)]' },
];

const previewWidth = (token: string) => `${Number(token) * 0.25}rem`;

export const ColorTokenGrid: FC = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {colorTokens.map(({ name, surface, foreground, description }) => (
      <div key={surface} className="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-sm">
        <div
          className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
          style={{
            backgroundColor: `var(--${surface})`,
            color: `var(--${foreground})`,
          }}
        >
          <span className="font-medium">{name}</span>
          <code className="text-xs font-mono text-muted-foreground">--{surface}</code>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
            <span>bg-{surface}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
            <span>text-{foreground}</span>
          </span>
        </div>
      </div>
    ))}
  </div>
);

export const TypographyScale: FC = () => (
  <div className="grid gap-4 md:grid-cols-2">
    {fontSizeEntries.map(([token, size]) => (
      <div key={token} className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-muted-foreground">{token}</span>
            <code className="text-xs font-mono text-muted-foreground">{size}</code>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">text-{token}</span>
        </div>
        <p
          className="font-sans text-foreground"
          style={{ fontSize: size, lineHeight: typographyScale.lineHeight.relaxed }}
        >
          The quick brown fox jumps over the lazy dog.
        </p>
      </div>
    ))}
  </div>
);

export const SpacingScale: FC = () => (
  <div className="space-y-3">
    {spacingEntries.map(({ token, value }) => (
      <div key={token} className="flex items-center gap-3">
        <div className="w-10 text-xs font-medium text-muted-foreground">{token}</div>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-accent" style={{ width: previewWidth(token) }} />
          </div>
        </div>
        <code className="w-20 text-right text-[11px] font-mono text-muted-foreground">{value}</code>
      </div>
    ))}
  </div>
);

export const RadiusTokenShowcase: FC = () => (
  <div className="space-y-3">
    {radiusTokens.map(({ name, className }) => (
      <div key={name} className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-[11px] font-mono text-muted-foreground">
          {name.replace('--', '')}
        </div>
        <div className="flex-1">
          <div className={`h-10 border border-border bg-background ${className}`} />
        </div>
        <code className="w-32 text-right text-[11px] font-mono text-muted-foreground">{className}</code>
      </div>
    ))}
  </div>
);

export const TokenDocsPage: FC = () => (
  <div className="space-y-10">
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This page previews Testero's core design tokens. Use the semantic layers when styling components so light and dark
        themes stay in sync.
      </p>
      <h2 className="text-lg font-semibold text-foreground">Color tokens</h2>
      <ColorTokenGrid />
    </section>
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Typography</h2>
      <p className="text-sm text-muted-foreground">
        Typography primitives flow through Tailwind's font families, sizes, weights, and line heights. Use semantic utilities like
        <code> text-muted-foreground</code> and <code> font-semibold</code> to stay aligned with the theme.
      </p>
      <TypographyScale />
    </section>
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Spacing & radius</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpacingScale />
        <RadiusTokenShowcase />
      </div>
    </section>
    <section className="space-y-2">
      <h3 className="text-base font-semibold text-foreground">Next steps</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Add semantic tokens for elevation overlays and chart palettes once finalized.</li>
        <li>Connect Storybook to automated visual regression (Chromatic or Playwright) to detect drift.</li>
      </ul>
    </section>
  </div>
);
