import type { Config } from "jest";

export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.jest.json",
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^remark$": "<rootDir>/__tests__/__mocks__/remark.js",
    "^remark-gfm$": "<rootDir>/__tests__/__mocks__/remark-gfm.js",
    "^remark-rehype$": "<rootDir>/__tests__/__mocks__/remark-rehype.js",
    "^rehype-raw$": "<rootDir>/__tests__/__mocks__/rehype-raw.js",
    "^rehype-stringify$": "<rootDir>/__tests__/__mocks__/rehype-stringify.js",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "/node_modules/(?!(\@supabase|posthog-node|remark|remark-.*|unified|unist-.*|mdast-.*|hast-.*|rehype-.*|gray-matter|uncrypto|@upstash)/)",
  ],
} satisfies Config;
