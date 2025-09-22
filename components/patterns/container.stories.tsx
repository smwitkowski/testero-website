import type { Meta, StoryObj } from "@storybook/react"

import { Container, type ContainerProps } from "./Container"

const meta: Meta<typeof Container> = {
  title: "Patterns/Container",
  component: Container,
  parameters: {
    docs: {
      description: {
        component:
          "Tokenised width wrapper that centers content and applies responsive horizontal padding consistent with the design system.",
      },
    },
  },
  argTypes: {
    as: { control: false },
    className: { control: false },
    children: { control: false },
    size: {
      control: { type: "inline-radio" },
      options: ["sm", "md", "lg", "xl", "2xl", "full"],
    },
  },
  args: {
    size: "xl",
  },
}

export default meta

type Story = StoryObj<typeof meta>

const Placeholder = ({ label }: { label: string }) => (
  <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
    {label}
  </div>
)

export const Playground: Story = {
  render: (args: ContainerProps) => (
    <div className="space-y-6 bg-surface/60 py-10">
      <Container {...args}>
        <Placeholder label={`Container size: ${args.size ?? "xl"}`} />
      </Container>
    </div>
  ),
}

export const CustomElement: Story = {
  args: {
    as: "section",
    size: "lg",
  },
  render: (args: ContainerProps<"section">) => (
    <div className="space-y-6 bg-surface/60 py-10">
      <Container {...args}>
        <Placeholder label="Rendered as a semantic <section> element" />
      </Container>
    </div>
  ),
}
