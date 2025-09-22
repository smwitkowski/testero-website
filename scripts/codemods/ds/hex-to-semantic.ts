import path from "node:path"

import { Node, Project, QuoteKind } from "ts-morph"

import {
  collectFiles,
  dedupeResults,
  logResult,
  parseArgs,
  type CodemodCLIOptions,
  type CodemodRunResult,
} from "./utils"

const hexPattern = /#(?:[0-9a-fA-F]{3,8})/g
const tokenMap = new Map<string, string>([
  ["#22c55e", "hsl(var(--success))"],
  ["#16a34a", "hsl(var(--success))"],
  ["#15803d", "hsl(var(--success))"],
  ["#f59e0b", "hsl(var(--warning))"],
  ["#f97316", "hsl(var(--warning))"],
  ["#ef4444", "hsl(var(--destructive))"],
  ["#dc2626", "hsl(var(--destructive))"],
  ["#0ea5e9", "hsl(var(--info))"],
  ["#38bdf8", "hsl(var(--info))"],
  ["#3b82f6", "hsl(var(--accent))"],
  ["#2563eb", "hsl(var(--accent))"],
])

function uniqueHexes(value: string) {
  const matches = value.match(hexPattern)
  if (!matches) return []
  return Array.from(new Set(matches.map((item) => item.toLowerCase())))
}

function transformLiteral(node: Node): boolean {
  if (!Node.isStringLiteral(node) && !Node.isNoSubstitutionTemplateLiteral(node)) {
    return false
  }

  const value = Node.isStringLiteral(node) ? node.getLiteralValue() : node.getLiteralText()
  const found = uniqueHexes(value)
  if (found.length === 0) {
    return false
  }

  let updated = value
  const unknown: string[] = []

  for (const hex of found) {
    const mapped = tokenMap.get(hex)
    if (mapped) {
      const regex = new RegExp(hex, "gi")
      updated = updated.replace(regex, mapped)
    } else {
      unknown.push(hex)
    }
  }

  if (Node.isStringLiteral(node)) {
    if (updated !== value) {
      node.setLiteralValue(updated)
    }
  } else if (Node.isNoSubstitutionTemplateLiteral(node)) {
    if (updated !== value) {
      node.replaceWithText("`" + updated + "`")
    }
  }

  if (unknown.length > 0) {
    const existingText = node.getText()
    if (!existingText.startsWith("/* TODO(ds-migration)")) {
      const comment = `/* TODO(ds-migration): replace ${unknown.join(", ")} with semantic design tokens */ `
      node.replaceWithText(comment + existingText)
    }
  }

  return true
}

async function transformFile(project: Project, filePath: string, dry: boolean): Promise<CodemodRunResult> {
  const source = project.addSourceFileAtPathIfExists(path.join(process.cwd(), filePath))
  if (!source) {
    return { file: filePath, applied: false, message: "missing source" }
  }

  let mutated = false

  source.forEachDescendant((node) => {
    if (transformLiteral(node)) {
      mutated = true
    }
  })

  if (!mutated) {
    return { file: filePath, applied: false }
  }

  if (!dry) {
    await source.save()
  }

  return { file: filePath, applied: true }
}

export async function apply(options: CodemodCLIOptions) {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    manipulationSettings: { quoteKind: QuoteKind.Double },
  })

  const files = await collectFiles(options)
  const results: CodemodRunResult[] = []

  for (const file of files) {
    const result = await transformFile(project, file, options.dry)
    if (options.verbose || result.applied) {
      logResult("hex-to-semantic", result, options.dry)
    }
    results.push(result)
  }

  const summary = dedupeResults(results).filter((item) => item.applied)
  if (summary.length && options.dry) {
    console.log(`\n${summary.length} files would be updated by hex-to-semantic.`)
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  await apply(options)
}

run().catch((error) => {
  console.error("hex-to-semantic failed", error)
  process.exitCode = 1
})
