import { promises as fs } from "node:fs"
import path from "node:path"

import { minimatch } from "minimatch"

export type CodemodCLIOptions = {
  dry: boolean
  include: string[]
  exclude: string[]
  verbose: boolean
}

export type CodemodRunResult = {
  file: string
  applied: boolean
  message?: string
}

const DEFAULT_IGNORES = new Set([
  "node_modules",
  ".next",
  ".git",
  "storybook-static",
  "dist",
  "build",
  "coverage",
])

export function parseArgs(argv: string[]): CodemodCLIOptions {
  const options: CodemodCLIOptions = {
    dry: false,
    include: ["components/**/*.tsx", "app/**/*.tsx", "lib/**/*.tsx"],
    exclude: ["**/__tests__/**", "**/*.stories.tsx", "**/*.spec.tsx"],
    verbose: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--dry") {
      options.dry = true
      continue
    }
    if (arg === "--verbose") {
      options.verbose = true
      continue
    }
    if (arg === "--include") {
      const value = argv[index + 1]
      if (!value) {
        throw new Error("Missing value for --include")
      }
      options.include.push(value)
      index += 1
      continue
    }
    if (arg === "--exclude") {
      const value = argv[index + 1]
      if (!value) {
        throw new Error("Missing value for --exclude")
      }
      options.exclude.push(value)
      index += 1
      continue
    }
  }

  return options
}

export async function collectFiles({ include, exclude }: Pick<CodemodCLIOptions, "include" | "exclude">) {
  const root = process.cwd()
  const files: string[] = []

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (DEFAULT_IGNORES.has(entry.name)) continue

      const absolutePath = path.join(currentDir, entry.name)
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/")

      if (entry.isDirectory()) {
        await walk(absolutePath)
        continue
      }

      if (!include.some((pattern) => minimatch(relativePath, pattern, { dot: true }))) {
        continue
      }

      if (exclude.some((pattern) => minimatch(relativePath, pattern, { dot: true }))) {
        continue
      }

      files.push(relativePath)
    }
  }

  await walk(root)
  return files.sort()
}

export async function readFile(filePath: string) {
  const absolutePath = path.join(process.cwd(), filePath)
  return fs.readFile(absolutePath, "utf8")
}

export async function writeFile(filePath: string, contents: string) {
  const absolutePath = path.join(process.cwd(), filePath)
  await fs.writeFile(absolutePath, contents, "utf8")
}

export function logResult(modName: string, result: CodemodRunResult, dry: boolean) {
  const action = result.applied ? (dry ? "would update" : "updated") : "skipped"
  const details = result.message ? ` → ${result.message}` : ""
  console.log(`[${modName}] ${action} ${result.file}${details}`)
}

export function dedupeResults(results: CodemodRunResult[]) {
  const seen = new Map<string, CodemodRunResult>()
  for (const result of results) {
    const existing = seen.get(result.file)
    if (!existing || result.applied) {
      seen.set(result.file, result)
    }
  }
  return Array.from(seen.values())
}
