import { RuleTester } from 'eslint';
import path from 'path';
import tsParser from '@typescript-eslint/parser';
import rule from '../rules/no-raw-colors';

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

ruleTester.run('design/no-raw-colors', rule as any, {
  valid: [
    {
      filename: 'components/button.tsx',
      code: `const accent = "var(--accent-color)";`,
      settings: sharedSettings,
    },
    {
      filename: 'app/page.tsx',
      code: `const accent = "hsl(var(--accent))";`,
      settings: sharedSettings,
    },
    {
      filename: 'components/demo.tsx',
      code: `<div style={{ color: "hsl(var(--foreground))" }} />;`,
      settings: sharedSettings,
    },
    {
      filename: 'lib/design-system/tokens/colors.ts',
      code: `export const palette = { blue50: "#eff6ff" };`,
      settings: sharedSettings,
    },
  ],
  invalid: [
    {
      filename: 'components/button.tsx',
      code: `const accent = "#0ea5e9";`,
      errors: [{ messageId: 'useTokens' }],
      settings: sharedSettings,
    },
    {
      filename: 'lib/colors.ts',
      code: `const danger = "rgba(255, 0, 0, 0.3)";`,
      errors: [{ messageId: 'useTokens' }],
      settings: sharedSettings,
    },
    {
      filename: 'components/card.tsx',
      code: `<div style={{ color: "hsl(210, 50%, 50%)" }} />;`,
      errors: [{ messageId: 'useHslVar' }],
      settings: sharedSettings,
    },
    {
      filename: 'components/template.tsx',
      code: 'const accent = `#ffffff`; ',
      errors: [{ messageId: 'useTokens' }],
      settings: sharedSettings,
    },
  ],
});
