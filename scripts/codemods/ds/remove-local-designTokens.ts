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

const DESIGN_TOKEN_IDENTIFIER = "designTokens"

const replacementMap = new Map<string, string>([
  ["colors.text.primary", '"text-foreground"'],
  ["colors.text.secondary", '"text-muted-foreground"'],
  ["colors.text.muted", '"text-muted-foreground"'],
  ["colors.logo.container", '"bg-surface-muted"'],
  ["colors.logo.border", '"border-border/60"'],
  ["typography.sectionTitle", '"text-3xl font-semibold tracking-tight"'],
  ["typography.subtitle", '"text-base text-muted-foreground"'],
  ["spacing.logo", '"h-12"'],
  ["spacing.logoContainer", '"h-24"'],
  ["effects.logoHover", '"transition-transform duration-200"'],
])

function getDesignTokenPath(node: Node): { expression: Node; path: string; segments: string[] } | null {
  if (!Node.isPropertyAccessExpression(node)) {
    return null
  }

  const parts: string[] = []
  let current: Node | undefined = node

  while (Node.isPropertyAccessExpression(current)) {
    parts.unshift(current.getName())
    current = current.getExpression()
  }

  if (!current || !Node.isIdentifier(current)) {
    return null
  }

  if (current.getText() !== DESIGN_TOKEN_IDENTIFIER) {
    return null
  }

  return { expression: node, path: parts.join("."), segments: parts }
}

async function transformFile(project: Project, filePath: string, dry: boolean): Promise<CodemodRunResult> {
  const source = project.addSourceFileAtPathIfExists(path.join(process.cwd(), filePath))
  if (!source) {
    return { file: filePath, applied: false, message: "missing source" }
  }

  let mutated = false

  source.forEachDescendant((node) => {
    if (!Node.isPropertyAccessExpression(node)) {
      return
    }

    const info = getDesignTokenPath(node)
    if (!info) {
      return
    }

    const replacement = replacementMap.get(info.path)
    if (replacement) {
      node.replaceWithText(replacement)
      mutated = true
      return
    }

    const fallback = `legacyDesignTokens.${info.segments.join(".")}`
    node.replaceWithText(`/* TODO(ds-migration): map ${info.path} */ ${fallback}`)
    mutated = true
  })

  const declaration = source.getVariableDeclaration(DESIGN_TOKEN_IDENTIFIER)
  if (declaration) {
    const initializer = declaration.getInitializer()?.getText() ?? "{}"
    const variableStatement = declaration.getVariableStatement()
    const declarationKind = variableStatement?.getDeclarationKind() ?? "const"

    if (variableStatement) {
      variableStatement.setIsExported(false)
      variableStatement.replaceWithText((writer) => {
        writer.writeLine(`// TODO(ds-migration): replace legacyDesignTokens with design-system primitives`)
        writer.write(`${declarationKind} legacyDesignTokens = ${initializer}`)
        writer.write(";")
      })
    }
    mutated = true
  }

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
      logResult("remove-local-designTokens", result, options.dry)
    }
    results.push(result)
  }

  const summary = dedupeResults(results).filter((item) => item.applied)
  if (summary.length && options.dry) {
    console.log(`\n${summary.length} files would be updated by remove-local-designTokens.`)
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  await apply(options)
}

run().catch((error) => {
  console.error("remove-local-designTokens failed", error)
  process.exitCode = 1
})
