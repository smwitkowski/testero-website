import type { Meta, StoryObj } from "@storybook/react"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  args: {
    children: "Button",
    tone: "accent",
    variant: "solid",
    size: "md",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["solid", "soft", "outline", "ghost", "link"],
    },
    tone: {
      control: "select",
      options: ["default", "accent", "success", "warn", "danger", "neutral"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    loading: { control: "boolean" },
    fullWidth: { control: "boolean" },
  },
  parameters: {
    layout: "centered",
  },
}

export default meta

type Story = StoryObj<typeof Button>

export const Playground: Story = {
  args: {
    iconRight: <ArrowRight className="h-4 w-4" />,
  },
}

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {(["solid", "soft", "outline", "ghost", "link"] as const).map((variant) => (
        <div key={variant} className="flex items-center gap-4">
          <span className="w-16 text-sm text-muted-foreground">{variant}</span>
          <div className="flex gap-2">
            <Button {...args} variant={variant} tone="accent">
              Accent
            </Button>
            <Button {...args} variant={variant} tone="neutral">
              Neutral
            </Button>
          </div>
        </div>
      ))}
    </div>
  ),
  args: {
    size: "md",
    loading: false,
    fullWidth: false,
  },
}

export const Tones: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      {(["default", "accent", "success", "warn", "danger", "neutral"] as const).map((tone) => (
        <Button key={tone} {...args} tone={tone}>
          {tone}
        </Button>
      ))}
    </div>
  ),
  args: {
    variant: "solid",
    size: "md",
  },
}

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-end gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Button key={size} {...args} size={size}>
          {size.toUpperCase()}
        </Button>
      ))}
    </div>
  ),
  args: {
    tone: "accent",
    variant: "solid",
  },
}

export const KeyboardFocus: Story = {
  render: () => (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>Press Tab to move focus to the button and verify the focus ring uses design tokens.</p>
      <Button tone="accent">Focusable button</Button>
    </div>
  ),
}
