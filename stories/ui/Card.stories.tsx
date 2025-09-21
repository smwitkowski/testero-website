import type { Meta, StoryObj } from "@storybook/react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: {
    docs: {
      description: {
        component: "Surface component that maps internal spacing to semantic design tokens.",
      },
    },
  },
  args: {
    variant: "default",
    size: "md",
    compact: false,
    inset: "none",
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["sm", "md", "lg"],
    },
    compact: {
      control: "boolean",
    },
    inset: {
      control: "inline-radio",
      options: ["none", "content", "all"],
    },
    variant: {
      control: "inline-radio",
      options: ["default", "elevated", "glass"],
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Team velocity</CardTitle>
        <CardDescription>
          Token-driven padding keeps analytics summaries visually balanced across breakpoints.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-card-md sm:grid-cols-2">
          <div className="rounded-lg border border-dashed border-border/60 px-card-x-sm py-card-y-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active testers</p>
            <p className="mt-2 text-2xl font-semibold">128</p>
          </div>
          <div className="rounded-lg border border-dashed border-border/60 px-card-x-sm py-card-y-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pass rate</p>
            <p className="mt-2 text-2xl font-semibold">92%</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <span className="text-sm text-muted-foreground">Synced 2 minutes ago</span>
        <CardAction>
          <Button variant="ghost" tone="neutral" size="sm">
            View logs
          </Button>
          <Button tone="accent" size="sm">
            Share report
          </Button>
        </CardAction>
      </CardFooter>
    </Card>
  ),
}

export const SizeVariants: Story = {
  render: () => (
    <div className="grid gap-card-lg md:grid-cols-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Card key={size} size={size}>
          <CardHeader>
            <CardTitle className="text-base font-semibold capitalize">{size} surface</CardTitle>
            <CardDescription>
              Horizontal padding and gaps respond to the selected size token.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-card-sm">
              <div className="rounded-lg bg-secondary/40 px-card-x-sm py-card-y-sm text-sm text-secondary-foreground">
                Primary metric
              </div>
              <div className="rounded-lg bg-secondary/20 px-card-x-sm py-card-y-sm text-sm text-secondary-foreground">
                Secondary insight
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
}

export const CompactDensity: Story = {
  render: () => (
    <div className="grid gap-card-lg md:grid-cols-2">
      <Card size="lg">
        <CardHeader>
          <CardTitle>Standard rhythm</CardTitle>
          <CardDescription>Default spacing provides breathing room for detailed content.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use the default density for marketing or educational narratives where readability is key.
          </p>
        </CardContent>
      </Card>
      <Card size="lg" compact>
        <CardHeader>
          <CardTitle>Compact rhythm</CardTitle>
          <CardDescription>Compact mode trims vertical padding for dense dashboards.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Toggle <code>compact</code> when cards appear in data tables or tight layouts.
          </p>
        </CardContent>
      </Card>
    </div>
  ),
}

export const InsetContent: Story = {
  render: () => (
    <Card size="lg" inset="content">
      <CardHeader>
        <CardTitle>Inset content</CardTitle>
        <CardDescription>Bleed charts or banners to the card edge without manual padding hacks.</CardDescription>
      </CardHeader>
      <CardContent className="gap-card-md px-section_md py-section_md">
        <div className="rounded-xl bg-gradient-to-r from-orange-400 to-red-500 px-card-x-md py-card-y-md text-white shadow-sm">
          <p className="text-sm uppercase tracking-wide opacity-80">Experiment velocity</p>
          <p className="mt-2 text-3xl font-semibold">+18%</p>
        </div>
        <p className="text-sm text-muted-foreground">
          When <code>inset="content"</code> is set, internal sections receive token-based negative margins so the
          content can extend to the card boundary while preserving consistent inner padding.
        </p>
      </CardContent>
    </Card>
  ),
}

export const LightAndDark: Story = {
  parameters: {
    backgrounds: { disable: true },
  },
  render: () => (
    <div className="grid gap-card-lg md:grid-cols-2">
      <Card size="md">
        <CardHeader>
          <CardTitle>Light mode</CardTitle>
          <CardDescription>Default theme uses foreground/background tokens.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Integrate charts, forms, or status blocks with zero custom padding.</p>
        </CardContent>
      </Card>
      <div className="dark rounded-xl bg-slate-950 px-card-x-lg py-card-y-lg text-white">
        <Card size="md" variant="elevated" className="bg-card/95">
          <CardHeader>
            <CardTitle>Dark mode</CardTitle>
            <CardDescription>Spacing tokens remain identical, ensuring parity across themes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The enclosing container toggles the <code>dark</code> class, demonstrating automatic adaptation.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
}
