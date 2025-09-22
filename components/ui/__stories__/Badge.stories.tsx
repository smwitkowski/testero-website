import type { Meta, StoryObj } from "@storybook/react"

import { Badge, type BadgeProps } from "../badge"

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  args: {
    children: "Badge label",
    variant: "soft",
    tone: "accent",
    size: "md",
  },
  argTypes: {
    variant: {
      control: { type: "inline-radio" },
      options: ["solid", "soft", "outline", "ghost"],
    },
    tone: {
      control: { type: "select" },
      options: ["default", "accent", "success", "warning", "danger", "neutral", "info"],
    },
    size: {
      control: { type: "inline-radio" },
      options: ["sm", "md"],
    },
    icon: { control: false },
    asChild: { control: { type: "boolean" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Semantic badge primitive that maps tone + variant props to design tokens. Supports icon slots and ghost/outline styles for marketing use cases.",
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

const tones: BadgeProps["tone"][] = [
  "default",
  "accent",
  "success",
  "warning",
  "danger",
  "neutral",
  "info",
]

export const ToneMatrix: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      {tones.map((tone) => (
        <Badge key={tone} {...args} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
}
