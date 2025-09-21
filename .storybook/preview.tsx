import type { Preview } from "@storybook/react";
import { withThemeByClassName } from "@storybook/addon-themes";

import "../app/globals.css";

const preview: Preview = {
  decorators: [
    withThemeByClassName({
      themes: {
        Light: '',
        Dark: 'dark',
      },
      defaultTheme: 'Light',
      parentSelector: 'html',
    }),
    (Story) => (
      <div className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Story />
      </div>
    ),
  ],
  parameters: {
    a11y: { disable: false },
    controls: { expanded: true },
    layout: 'centered',
    docs: { toc: true },
    themes: {
      default: 'Light',
      list: [
        { name: 'Light', class: '', color: '#ffffff' },
        { name: 'Dark', class: 'dark', color: '#0b0b0b' },
      ],
      target: 'html',
    },
  },
};

export default preview;
