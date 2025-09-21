import type { Meta, StoryObj } from '@storybook/react';

import { TokenDocsPage } from './token-sections';

const meta = {
  title: 'Foundations/Tokens',
  component: TokenDocsPage,
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    docs: {
      page: () => <TokenDocsPage />,
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TokenDocsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => <TokenDocsPage />,
};
