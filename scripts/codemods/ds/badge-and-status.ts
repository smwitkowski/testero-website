import path from "node:path"

import { JsxAttribute, JsxElement, Node, Project, QuoteKind, SyntaxKind } from "ts-morph"

import {
  collectFiles,
  dedupeResults,
  logResult,
  parseArgs,
  type CodemodCLIOptions,
  type CodemodRunResult,
} from "./utils"

const toneMatchers: { match: RegExp; tone: string }[] = [
  { match: /bg-(green|emerald|success)/, tone: "success" },
  { match: /bg-(yellow|amber|warning)/, tone: "warning" },
  { match: /bg-(red|rose|destructive|error)/, tone: "danger" },
  { match: /bg-(blue|cyan|accent)/, tone: "accent" },
  { match: /bg-(gray|slate|neutral)/, tone: "neutral" },
]

function getClassAttribute(element: JsxElement): JsxAttribute | undefined {
  for (const attribute of element.getOpeningElement().getAttributes()) {
    if (!Node.isJsxAttribute(attribute)) continue
    const name = attribute.getNameNode().getText()
    if (name === "className") {
      return attribute
    }
  }
  return undefined
}

function splitClasses(value: string) {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function determineTone(classes: string[]): string | undefined {
  const classString = classes.join(" ")
  for (const matcher of toneMatchers) {
    if (matcher.match.test(classString)) {
      return matcher.tone
    }
  }
  return undefined
}

function looksLikeBadge(classes: string[]) {
  return classes.includes("rounded-full") && classes.some((token) => token.startsWith("px-"))
}

function ensureBadgeImport(source: ReturnType<Project["addSourceFileAtPathIfExists"]>) {
  if (!source) return
  const existing = source.getImportDeclarations().find((decl) => decl.getModuleSpecifierValue() === "@/components/ui/badge")
  if (existing) {
    if (!existing.getNamedImports().some((named) => named.getName() === "Badge")) {
      existing.addNamedImport({ name: "Badge" })
    }
    return
  }
  source.addImportDeclaration({ moduleSpecifier: "@/components/ui/badge", namedImports: [{ name: "Badge" }] })
}

function transformBadge(source: ReturnType<Project["addSourceFileAtPathIfExists"]>, element: JsxElement) {
  const opening = element.getOpeningElement()
  const closing = element.getClosingElement()
  const classAttr = getClassAttribute(element)
  if (!classAttr) return false
  const initializer = classAttr.getInitializer()
  if (!initializer || !Node.isStringLiteral(initializer)) {
    return false
  }

  const classes = splitClasses(initializer.getLiteralValue())
  if (!looksLikeBadge(classes)) {
    return false
  }

  const tone = determineTone(classes)
  const removablePrefixes = ["bg-", "text-", "shadow", "hover:", "px-", "py-", "uppercase", "tracking-", "font-bold", "font-semibold"]
  const remaining = classes.filter((token) => !removablePrefixes.some((prefix) => token.startsWith(prefix)) && token !== "rounded-full")

  if (remaining.length) {
    initializer.setLiteralValue(Array.from(new Set(remaining)).join(" "))
  } else {
    classAttr.remove()
  }

  const tagName = opening.getTagNameNode().getText()
  if (tagName !== "Badge") {
    opening.getTagNameNode().replaceWithText("Badge")
    closing?.getTagNameNode().replaceWithText("Badge")
  }

  if (tone) {
    opening.addAttribute({ name: "tone", initializer: `"${tone}"` })
  }
  opening.addAttribute({ name: "variant", initializer: '"soft"' })
  ensureBadgeImport(source)
  return true
}

async function transformFile(project: Project, filePath: string, dry: boolean): Promise<CodemodRunResult> {
  const source = project.addSourceFileAtPathIfExists(path.join(process.cwd(), filePath))
  if (!source) {
    return { file: filePath, applied: false, message: "missing source" }
  }

  let mutated = false

  source.getDescendantsOfKind(SyntaxKind.JsxElement).forEach((element) => {
    const tagName = element.getOpeningElement().getTagNameNode().getText()
    if (tagName === "Badge") {
      return
    }

    if (transformBadge(source, element)) {
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
      logResult("badge-and-status", result, options.dry)
    }
    results.push(result)
  }

  const summary = dedupeResults(results).filter((item) => item.applied)
  if (summary.length && options.dry) {
    console.log(`\n${summary.length} files would be updated by badge-and-status.`)
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  await apply(options)
}

run().catch((error) => {
  console.error("badge-and-status failed", error)
  process.exitCode = 1
})
