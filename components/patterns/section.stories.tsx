import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "@/components/ui/button"

import { Section } from "./section"

const meta = {
  title: "Patterns/Section",
  component: Section,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Reusable layout primitive that standardises vertical rhythm, background surfaces, and optional dividers.",
      },
    },
  },
  args: {
    size: "lg",
    surface: "default",
    divider: "none",
    contained: true,
  },
  argTypes: {
    size: {
      control: { type: "inline-radio" },
      options: ["sm", "md", "lg", "xl"],
    },
    surface: {
      control: { type: "select" },
      options: ["default", "subtle", "muted", "elevated", "brand"],
    },
    divider: {
      control: { type: "inline-radio" },
      options: ["none", "top", "bottom", "both"],
    },
    contained: {
      control: { type: "boolean" },
    },
  },
} satisfies Meta<typeof Section>

export default meta

type Story = StoryObj<typeof Section>

export const Playground: Story = {
  render: (args) => (
    <Section {...args}>
      <div className="space-y-6">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">Consistent rhythm</h2>
          <p className="text-muted-foreground">
            Use semantic spacing, surfaces, and dividers to maintain predictable vertical rhythm across pages. Toggle the
            controls to preview each variant, including dark mode via the toolbar theme switcher.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button size="lg">Primary action</Button>
          <Button size="lg" variant="outline">
            Secondary
          </Button>
        </div>
      </div>
    </Section>
  ),
}

export const FullBleed: Story = {
  args: {
    contained: false,
    surface: "brand",
    size: "xl",
    divider: "both",
  },
  render: (args) => (
    <Section {...args} className="overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 opacity-90" />
      <div className="relative">
        <div className="py-section_lg">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center text-white">
            <h2 className="text-4xl font-bold tracking-tight">Full-bleed hero</h2>
            <p className="mt-4 text-lg text-blue-100">
              Combine the Section primitive with your own layout primitives for wide experiences while preserving rhythm and
              divider tokens.
            </p>
          </div>
        </div>
      </div>
    </Section>
  ),
  parameters: {
    backgrounds: { default: "dark" },
  },
}
