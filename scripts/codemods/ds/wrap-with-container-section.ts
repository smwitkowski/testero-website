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

const containerTokens = ["max-w-7xl", "mx-auto", "px-4", "sm:px-6", "lg:px-8"]

const sectionPatterns = [
  { tokens: ["py-12", "md:py-16"], size: "md" as const },
  { tokens: ["py-16", "md:py-20"], size: "lg" as const },
  { tokens: ["py-20", "lg:py-24"], size: "xl" as const },
  { tokens: ["py-8"], size: "sm" as const },
]

function splitClasses(value: string) {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function removeTokens(value: string, tokens: string[]) {
  const classes = splitClasses(value)
  const remaining = classes.filter((token) => !tokens.includes(token))
  const removed = classes.filter((token) => tokens.includes(token))
  return {
    remaining: Array.from(new Set(remaining)).join(" ").trim(),
    removed,
  }
}

function ensureImport(source: ReturnType<Project["addSourceFileAtPathIfExists"]>, name: string, moduleSpecifier: string) {
  if (!source) return
  const existing = source.getImportDeclarations().find((decl) => decl.getModuleSpecifierValue() === moduleSpecifier)
  if (existing) {
    if (!existing.getNamedImports().some((named) => named.getName() === name)) {
      existing.addNamedImport({ name })
    }
    return
  }
  source.addImportDeclaration({ moduleSpecifier, namedImports: [{ name }] })
}

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

function wrapWithContainer(source: ReturnType<Project["addSourceFileAtPathIfExists"]>, element: JsxElement) {
  const classAttr = getClassAttribute(element)
  if (!classAttr) return false

  const initializer = classAttr.getInitializer()
  if (!initializer || !Node.isStringLiteral(initializer)) {
    return false
  }

  const { remaining } = removeTokens(initializer.getLiteralValue(), containerTokens)
  if (remaining === initializer.getLiteralValue()) {
    return false
  }

  if (remaining) {
    initializer.setLiteralValue(remaining)
  } else {
    classAttr.remove()
  }

  const indent = element.getIndentationText() ?? ""
  const indentUnit = element.getSourceFile().getIndentationText()
  const replacement = `${indent}<Container>\n${indent}${indentUnit}${element.getText()}\n${indent}</Container>`
  element.replaceWithText(replacement)
  ensureImport(source, "Container", "@/components/patterns")
  return true
}

function detectSectionSize(value: string) {
  for (const pattern of sectionPatterns) {
    const tokensPresent = pattern.tokens.every((token) => value.includes(token))
    if (tokensPresent) {
      return pattern
    }
  }
  return null
}

function wrapWithSection(source: ReturnType<Project["addSourceFileAtPathIfExists"]>, element: JsxElement) {
  const classAttr = getClassAttribute(element)
  if (!classAttr) return false
  const initializer = classAttr.getInitializer()
  if (!initializer || !Node.isStringLiteral(initializer)) {
    return false
  }

  const pattern = detectSectionSize(initializer.getLiteralValue())
  if (!pattern) {
    return false
  }

  const { remaining } = removeTokens(initializer.getLiteralValue(), pattern.tokens)
  if (remaining) {
    initializer.setLiteralValue(remaining)
  } else {
    classAttr.remove()
  }

  const indent = element.getIndentationText() ?? ""
  const indentUnit = element.getSourceFile().getIndentationText()
  const sizeProp = pattern.size ? ` size=\"${pattern.size}\"` : ""
  const replacement = `${indent}<Section${sizeProp}>\n${indent}${indentUnit}${element.getText()}\n${indent}</Section>`
  element.replaceWithText(replacement)
  ensureImport(source, "Section", "@/components/patterns")
  return true
}

async function transformFile(project: Project, filePath: string, dry: boolean): Promise<CodemodRunResult> {
  const source = project.addSourceFileAtPathIfExists(path.join(process.cwd(), filePath))
  if (!source) {
    return { file: filePath, applied: false, message: "missing source" }
  }

  let mutated = false

  source.getDescendantsOfKind(SyntaxKind.JsxElement).forEach((element) => {
    if (Node.isJsxOpeningElement(element.getParent())) {
      return
    }

    const tagName = element.getOpeningElement().getTagNameNode().getText()
    if (tagName === "Container" || tagName === "Section") {
      return
    }

    if (wrapWithContainer(source, element)) {
      mutated = true
      return
    }

    if (wrapWithSection(source, element)) {
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
      logResult("wrap-with-container-section", result, options.dry)
    }
    results.push(result)
  }

  const summary = dedupeResults(results).filter((item) => item.applied)
  if (summary.length && options.dry) {
    console.log(`\n${summary.length} files would be updated by wrap-with-container-section.`)
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  await apply(options)
}

run().catch((error) => {
  console.error("wrap-with-container-section failed", error)
  process.exitCode = 1
})
