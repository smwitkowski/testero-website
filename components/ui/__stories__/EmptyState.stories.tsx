import type { Meta, StoryObj } from "@storybook/react"
import { Inbox, ShieldAlert, Sparkles, Star, Upload } from "lucide-react"

import { Button } from "../button"
import { EmptyState } from "../empty-state"

const meta: Meta<typeof EmptyState> = {
  title: "Design System/EmptyState",
  component: EmptyState,
  parameters: {
    layout: "centered",
  },
  args: {
    title: "No conversations yet",
    description: "Kick off your next study by inviting candidates or importing interview notes.",
    icon: <Inbox aria-hidden="true" className="size-6" />,
    iconAriaLabel: "Empty inbox",
    tone: "neutral",
    size: "md",
    alignment: "center",
  },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["neutral", "info", "success", "warning", "danger"],
    },
    size: {
      control: "inline-radio",
      options: ["sm", "md", "lg"],
    },
    alignment: {
      control: "inline-radio",
      options: ["center", "left"],
    },
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Neutral: Story = {
  args: {
    primaryAction: {
      label: "Invite participants",
      onClick: () => console.log("invite"),
    },
    secondaryAction: {
      label: "Import CSV",
      onClick: () => console.log("import"),
    },
  },
}

export const Informational: Story = {
  args: {
    tone: "info",
    icon: <Sparkles aria-hidden="true" className="size-6" />,
    statusLabel: "Recommendations",
    title: "Fine-tune your prompts",
    description:
      "Review the generative AI checklist to improve reliability before sharing with the team.",
  },
}

export const Success: Story = {
  args: {
    tone: "success",
    icon: <Star aria-hidden="true" className="size-6" />,
    title: "All caught up",
    description: "Every diagnostic has been reviewed. We'll notify you if something changes.",
  },
}

export const Warning: Story = {
  args: {
    tone: "warning",
    icon: <ShieldAlert aria-hidden="true" className="size-6" />,
    title: "Quota nearly reached",
    description: "Usage is at 92% of your monthly limit. Upgrade to avoid throttling.",
    primaryAction: {
      label: "Upgrade plan",
      onClick: () => console.log("upgrade"),
    },
  },
}

export const DangerLeftAligned: Story = {
  args: {
    tone: "danger",
    alignment: "left",
    size: "lg",
    icon: <Upload aria-hidden="true" className="size-6" />,
    statusLabel: "Upload failed",
    title: "We couldn't process your file",
    description: (
      <span>
        Double-check the template and try again. <Button variant="link">Download sample</Button>
      </span>
    ),
  },
}
