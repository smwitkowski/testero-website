import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "../button"
import { PageHeader } from "../page-header"

const meta: Meta<typeof PageHeader> = {
  title: "Design System/PageHeader",
  component: PageHeader,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    title: "Analytics overview",
    description: "Monitor how each experiment performs and spot bottlenecks before they grow.",
  },
  argTypes: {
    density: {
      control: "inline-radio",
      options: ["comfortable", "compact"],
    },
    align: {
      control: "inline-radio",
      options: ["left", "between"],
    },
    tone: {
      control: "inline-radio",
      options: ["default", "muted"],
    },
    headingLevel: {
      control: "inline-radio",
      options: ["h1", "h2", "h3", "h4", "h5", "h6"],
    },
  },
}

export default meta

type Story = StoryObj<typeof PageHeader>

export const Default: Story = {}

export const WithBreadcrumbs: Story = {
  args: {
    breadcrumbs: [
      { label: "Dashboard", href: "#" },
      { label: "Analytics", href: "#" },
      { label: "Overview" },
    ],
  },
}

export const WithActions: Story = {
  args: {
    align: "between",
    actions: (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" tone="neutral">
          Share
        </Button>
        <Button tone="accent">Create report</Button>
      </div>
    ),
  },
}

export const MutedSurface: Story = {
  args: {
    tone: "muted",
    breadcrumbs: [
      { label: "Billing", href: "#" },
      { label: "Plans" },
    ],
    actions: (
      <Button tone="accent">Upgrade plan</Button>
    ),
  },
}

export const CompactDensity: Story = {
  args: {
    density: "compact",
    description: "Use compact density for data-heavy views or layouts with limited vertical space.",
  },
}

export const NoDescription: Story = {
  args: {
    description: undefined,
    breadcrumbs: [{ label: "Settings" }],
  },
}
