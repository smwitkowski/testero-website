import { RuleTester } from 'eslint';
import rule from '../rules/no-tailwind-arbitrary-values';
import path from 'path';
import tsParser from '@typescript-eslint/parser';

const sharedSettings = {
  design: {
    configPath: path.join(__dirname, '../../eslint-rules.config.json'),
    allowlistPath: path.join(__dirname, '../../.lint-rules-allowlist.json'),
  },
};

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser as any,
    sourceType: 'module',
    ecmaVersion: 2020,
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
  settings: sharedSettings,
});

ruleTester.run('design/no-tailwind-arbitrary-values', rule as any, {
  valid: [
    {
      filename: 'components/button.tsx',
      code: `<div className="bg-accent text-fg w-64" />;`,
      settings: sharedSettings,
    },
    {
      filename: 'components/allowed.tsx',
      code: `<div className="grid-cols-[auto-fit,minmax(200px,1fr)]" />;`,
      settings: sharedSettings,
    },
    {
      filename: 'components/ui/dialog.tsx',
      code: `<div className="translate-x-[-50%]" />;`,
      settings: sharedSettings,
    },
  ],
  invalid: [
    {
      filename: 'components/card.tsx',
      code: `<div className="bg-[#0ea5e9]" />;`,
      errors: [{ messageId: 'disallowColor' }],
      settings: sharedSettings,
    },
    {
      filename: 'components/layout.tsx',
      code: `<div className={clsx('w-[742px]', condition && 'h-[44px]')}></div>;`,
      errors: [
        { messageId: 'disallowDimension' },
        { messageId: 'disallowDimension' },
      ],
      settings: sharedSettings,
    },
    {
      filename: 'components/modal.tsx',
      code: `<div className="z-[9999]" />;`,
      errors: [{ messageId: 'disallowZIndex' }],
      settings: {
        design: {
          configPath: path.join(__dirname, '../../eslint-rules.config.json'),
          allowlistPath: path.join(__dirname, '../../.lint-rules-allowlist.json'),
        },
      },
    },
    {
      filename: 'components/heading.tsx',
      code: `<h1 className="leading-[1.1] tracking-[-0.02em]">Hello</h1>;`,
      errors: [
        { messageId: 'disallowTypography' },
        { messageId: 'disallowTypography' },
      ],
      settings: {
        design: {
          configPath: path.join(__dirname, '../../eslint-rules.config.json'),
          allowlistPath: path.join(__dirname, '../../.lint-rules-allowlist.json'),
        },
      },
    },
  ],
});
