# ScoreChart

The `ScoreChart` component renders a circular progress visualization for diagnostic scores. It now uses semantic design tokens so colors respond correctly in light and dark modes without inline overrides.

## Usage

```tsx
import { ScoreChart } from "@/components/diagnostic/ScoreChart";

export function DiagnosticSummary() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Light mode</p>
        <ScoreChart score={82} showStatus />
      </div>
      <div className="space-y-2 rounded-lg bg-background p-4 dark:bg-background">
        <p className="text-sm text-muted-foreground">Dark mode</p>
        <div className="dark">
          <ScoreChart score={42} showStatus />
        </div>
      </div>
    </div>
  );
}
```

> Wrap a parent element with the `dark` class to preview dark theme tokens locally.

## Tone mapping

| Score range | Tone class      | Semantic intent |
| ----------- | --------------- | ---------------- |
| 70 – 100    | `text-success`  | Success / strong performance |
| 50 – 69     | `text-warning`  | Warning / keep practicing |
| 0 – 49      | `text-error`    | Error / needs improvement |

The circular stroke and numeric label share the same tone class, while the track uses the neutral `text-muted` token.

## Theming notes

- All colors come from Tailwind semantic tokens (`success`, `warning`, `error`, `muted`).
- SVG circles use `stroke="currentColor"` so they inherit the tone from their semantic text class.
- No inline color styles remain, which keeps theming centralized in the design token layer.

This setup ensures the chart automatically adjusts when `.dark` theme variables are active.
