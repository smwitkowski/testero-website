import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: {
    docs: {
      description: {
        component: "Layout surface that applies design token spacing and elevation presets.",
      },
    },
  },
  args: {
    className: "bg-card text-card-foreground border border-border shadow-sm",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

type CardStoryArgs = ComponentProps<typeof Card>;

export const Default: Story = {
  args: {
    children: (
      <CardContent className="space-y-2">
        <CardTitle className="text-lg font-semibold">Analytics summary</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Structure content with token-backed typography and spacing utilities.
        </CardDescription>
      </CardContent>
    ),
  },
};

export const WithHeader: Story = {
  render: (args: CardStoryArgs) => (
    <Card {...args} className="bg-card text-card-foreground border border-border shadow-sm">
      <CardHeader className="gap-1">
        <CardTitle className="text-xl font-semibold">Plan usage</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Tokens ensure consistent spacing and typography across surfaces.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">You have used 68% of your testing minutes this cycle.</p>
        <div className="rounded-lg bg-secondary p-4 text-secondary-foreground">
          <p className="text-sm font-medium">Upgrade to increase limits and unlock advanced analytics.</p>
        </div>
      </CardContent>
    </Card>
  ),
};

export const WithActions: Story = {
  render: (args: CardStoryArgs) => (
    <Card {...args} className="bg-card text-card-foreground border border-border shadow-sm">
      <CardHeader className="gap-1 pb-0">
        <CardTitle className="text-xl font-semibold">Invite teammates</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Encourage collaboration with shared workspaces.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Teammates inherit workspace permissions and can help triage issues faster.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">5 seats remaining</div>
        <CardAction className="gap-2 md:justify-end">
          <Button variant="ghost" tone="neutral">
            Skip for now
          </Button>
          <Button tone="accent">Invite</Button>
        </CardAction>
      </CardFooter>
    </Card>
  ),
};

export const Elevated: Story = {
  args: {
    className: "bg-card text-card-foreground border border-border shadow-lg",
    children: (
      <>
        <CardHeader className="gap-1">
          <CardTitle className="text-xl font-semibold">Research highlights</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Elevated variant demonstrates higher emphasis with additional depth.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use `gap` utilities from the spacing scale (e.g., `gap-3`, `gap-6`) to organize stacked content.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Completion rate</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">92%</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Median duration</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">4.2 min</p>
            </div>
          </div>
        </CardContent>
      </>
    ),
  },
};
