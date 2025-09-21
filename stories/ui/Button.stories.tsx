import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";

import { Button } from "@/components/ui/button";

const toneOptions = ["default", "accent", "success", "warn", "danger", "neutral"] as const;
const variantOptions = ["solid", "soft", "outline", "ghost", "link"] as const;
const sizeOptions = ["sm", "md", "lg"] as const;

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: {
    a11y: { element: "#storybook-root" },
    docs: {
      description: {
        component:
          "Token-driven button component showcasing variants, tones, and sizes from the design system.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: variantOptions,
    },
    tone: {
      control: "select",
      options: toneOptions,
    },
    size: {
      control: "select",
      options: sizeOptions,
    },
    disabled: { control: "boolean" },
    fullWidth: { control: "boolean" },
    loading: { control: "boolean" },
    children: { control: "text" },
  },
  args: {
    children: "Click me",
    variant: "solid",
    tone: "accent",
    size: "md",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Primary action",
  },
};

export const Soft: Story = {
  args: {
    variant: "soft",
    children: "Soft action",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Outline action",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ghost action",
  },
};

export const Tones: Story = {
  args: {
    variant: "solid",
  },
  render: (args) => (
    <div className="flex flex-wrap items-start gap-3">
      {toneOptions.map((tone) => (
        <Button key={tone} {...args} tone={tone}>
          {tone}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  args: {
    tone: "accent",
  },
  render: (args) => (
    <div className="flex items-end gap-3">
      {sizeOptions.map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Button {...args} size={size}>
            {size.toUpperCase()}
          </Button>
          <span className="text-xs text-muted-foreground">{size}</span>
        </div>
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Disabled state",
  },
};

export const FocusVisible: Story = {
  args: {
    children: "Focus me with Tab",
  },
  render: (args) => (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>Use the keyboard (Tab) to verify the focus ring draws from the tokenized outline styles.</p>
      <Button {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const focusTarget = await canvas.findByRole("button", { name: /focus me/i });
    await expect(focusTarget).toHaveFocus();
  },
};
