import path from 'path';
import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  stories: [
    '../stories/**/*.stories.@(tsx|mdx)',
    '../components/**/*.stories.@(tsx|mdx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
    '@storybook/addon-themes',
  ],
  staticDirs: ['../public'],
  docs: {
    autodocs: true,
  },
  webpackFinal: async (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.resolve(__dirname, '..'),
    };
    config.resolve.extensions = Array.from(
      new Set([...(config.resolve.extensions ?? []), '.ts', '.tsx', '.js', '.jsx'])
    );
    config.module = config.module ?? { rules: [] };
    config.module.rules = config.module.rules ?? [];
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      exclude: /node_modules/,
      use: [
        {
          loader: require.resolve('babel-loader'),
          options: {
            presets: [require.resolve('next/babel')],
          },
        },
      ],
    });
    return config;
  },
};

export default config;
