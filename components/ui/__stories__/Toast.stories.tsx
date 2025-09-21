import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "../button"
import { Toast, type ToastProps, useToastQueue } from "../toast"

const meta: Meta<typeof Toast> = {
  title: "Design System/Toast",
  component: Toast,
  parameters: {
    layout: "centered",
  },
  args: {
    tone: "info",
    elevation: "sm",
    dismissible: true,
    title: "Changes published",
    description: "Your updates are now live for all reviewers.",
  },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["info", "success", "warning", "danger"],
    },
    elevation: {
      control: "inline-radio",
      options: ["none", "sm", "md"],
    },
    dismissible: {
      control: "boolean",
    },
  },
}

export default meta

type Story = StoryObj<typeof Toast>

export const Info: Story = {
  args: {
    action: {
      label: "View", 
      onClick: () => console.log("view"),
    },
  },
}

export const Success: Story = {
  args: {
    tone: "success",
    title: "Diagnostics exported",
    description: "We emailed the report to your analytics inbox.",
    action: {
      label: "Undo",
      onClick: () => console.log("undo"),
    },
  },
}

export const Warning: Story = {
  args: {
    tone: "warning",
    title: "Connection unstable",
    description: "We'll keep trying in the background and alert you if it fails.",
  },
}

export const Danger: Story = {
  args: {
    tone: "danger",
    title: "Sync failed",
    description: "Retry syncing the library or download a backup.",
    action: {
      label: "Retry",
      onClick: () => console.log("retry"),
    },
  },
}

const QueueDemo = () => {
  const { toasts, addToast, dismissToast } = useToastQueue()

  const pushToast = (overrides: Partial<ToastProps>) => {
    addToast({
      tone: "info",
      dismissible: true,
      elevation: "md",
      title: "Workflow saved",
      description: "Changes will publish once approved.",
      ...overrides,
    })
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => pushToast({ tone: "success", title: "Segment created", description: "It will appear in targeting shortly." })}>
          Success toast
        </Button>
        <Button variant="outline" onClick={() => pushToast({ tone: "warning", title: "API latency", description: "Traffic is spiking, we are scaling workers." })}>
          Warning toast
        </Button>
        <Button variant="ghost" tone="danger" onClick={() => pushToast({ tone: "danger", title: "Deployment failed", description: "Rollback triggered. Investigate the build logs." })}>
          Danger toast
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        {toasts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
            Trigger a toast to preview the stack.
          </div>
        ) : (
          toasts.map(({ id, ...toast }) => (
            <Toast
              key={id}
              {...toast}
              onClose={() => dismissToast(id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export const Queue: Story = {
  render: () => <QueueDemo />,
}
