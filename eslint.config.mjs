import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

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
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: sectionPaddingSelector,
          message:
            "Use the <Section> primitive for vertical rhythm instead of ad-hoc py-16/py-20 patterns. Add // eslint-disable-next-line no-restricted-syntax for intentional overrides.",
        },
      ],
    },
  },
];

export default eslintConfig;
