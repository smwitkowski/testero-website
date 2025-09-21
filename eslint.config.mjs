import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import designPlugin from "./eslint/plugins/eslint-plugin-design/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const sectionPaddingSelector =
  "JSXAttribute[name.name='className'][value.type='Literal'][value.value=/\\b(?:sm:|md:|lg:|xl:)?py-(?:16|20|24|32)\\b/]"

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      design: designPlugin,
    },
    settings: {
      design: {
        configPath: "eslint-rules.config.json",
        allowlistPath: ".lint-rules-allowlist.json",
      },
    },
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: sectionPaddingSelector,
          message:
            "Use the <Section> primitive for vertical rhythm instead of ad-hoc py-16/py-20 patterns. Add // eslint-disable-next-line no-restricted-syntax for intentional overrides.",
        },
      ],
      "design/no-raw-colors": "error",
      "design/no-tailwind-arbitrary-values": "error",
    },
  },
  {
    files: ["**/*.stories.@(tsx|mdx)"],
    rules: {
      "design/no-tailwind-arbitrary-values": "warn",
    },
  },
  {
    files: ["**/__tests__/**/*.{js,jsx,ts,tsx}", "**/*.spec.@(js|jsx|ts|tsx)"],
    rules: {
      "design/no-raw-colors": "warn",
    },
  },
  {
    files: ["scripts/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "design/no-tailwind-arbitrary-values": "off",
      "design/no-raw-colors": "off",
    },
  },
];

export default eslintConfig;
