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

const gradientTokens = [
  "bg-gradient-to-r",
  "from-blue-600",
  "to-cyan-600",
  "hover:from-blue-700",
  "hover:to-cyan-700",
]

const neutralTokens = ["bg-gray-900", "hover:bg-gray-800", "text-white"]

const spacingTokens = new Set(["px-6", "py-3", "px-5", "py-2", "rounded-lg", "rounded-2xl", "transition-all", "duration-200"])

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

function determineSize(classes: string[]) {
  if (classes.includes("py-3") || classes.includes("h-12")) return "lg"
  if (classes.includes("py-2.5") || classes.includes("py-2")) return "md"
  return undefined
}

function transformButton(source: ReturnType<Project["addSourceFileAtPathIfExists"]>, element: JsxElement) {
  const opening = element.getOpeningElement()
  const closing = element.getClosingElement()
  const classAttr = getClassAttribute(element)
  if (!classAttr) return false
  const initializer = classAttr.getInitializer()
  if (!initializer || !Node.isStringLiteral(initializer)) {
    return false
  }

  const classes = splitClasses(initializer.getLiteralValue())
  let tone: string | undefined
  let variant: string | undefined
  const removable = new Set<string>()

  if (gradientTokens.every((token) => classes.includes(token))) {
    tone = "accent"
    variant = "solid"
    gradientTokens.forEach((token) => removable.add(token))
    removable.add("text-white")
    removable.add("shadow-md")
    removable.add("hover:shadow-lg")
  }

  if (!tone && neutralTokens.some((token) => classes.includes(token))) {
    tone = "neutral"
    variant = "solid"
    neutralTokens.forEach((token) => removable.add(token))
  }

  const size = determineSize(classes)
  if (size) {
    spacingTokens.forEach((token) => {
      if (classes.includes(token)) {
        removable.add(token)
      }
    })
  }

  let fullWidth = false
  if (classes.includes("w-full")) {
    fullWidth = true
    removable.add("w-full")
  }

  if (!tone && !variant && !fullWidth && !size) {
    return false
  }

  const remainingClasses = classes.filter((token) => !removable.has(token))
  if (remainingClasses.length) {
    initializer.setLiteralValue(Array.from(new Set(remainingClasses)).join(" "))
  } else {
    classAttr.remove()
  }

  opening.getTagNameNode().replaceWithText("Button")
  closing?.getTagNameNode().replaceWithText("Button")

  if (variant) {
    opening.addAttribute({ name: "variant", initializer: `"${variant}"` })
  }
  if (tone) {
    opening.addAttribute({ name: "tone", initializer: `"${tone}"` })
  }
  if (size) {
    opening.addAttribute({ name: "size", initializer: `"${size}"` })
  }
  if (fullWidth) {
    opening.addAttribute({ name: "fullWidth" })
  }

  const hasTypeAttribute = opening
    .getAttributes()
    .some((attr) => Node.isJsxAttribute(attr) && attr.getNameNode().getText() === "type")
  if (!hasTypeAttribute) {
    opening.addAttribute({ name: "type", initializer: '"button"' })
  }

  ensureButtonImport(source)
  return true
}

function ensureButtonImport(source: ReturnType<Project["addSourceFileAtPathIfExists"]>) {
  if (!source) return
  const existing = source.getImportDeclarations().find((decl) => decl.getModuleSpecifierValue() === "@/components/ui/button")
  if (existing) {
    if (!existing.getNamedImports().some((named) => named.getName() === "Button")) {
      existing.addNamedImport({ name: "Button" })
    }
    return
  }
  source.addImportDeclaration({ moduleSpecifier: "@/components/ui/button", namedImports: [{ name: "Button" }] })
}

async function transformFile(project: Project, filePath: string, dry: boolean): Promise<CodemodRunResult> {
  const source = project.addSourceFileAtPathIfExists(path.join(process.cwd(), filePath))
  if (!source) {
    return { file: filePath, applied: false, message: "missing source" }
  }

  let mutated = false

  source.getDescendantsOfKind(SyntaxKind.JsxElement).forEach((element) => {
    const tagName = element.getOpeningElement().getTagNameNode().getText()
    if (tagName !== "button") {
      return
    }

    if (transformButton(source, element)) {
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
      logResult("button-to-ds-variants", result, options.dry)
    }
    results.push(result)
  }

  const summary = dedupeResults(results).filter((item) => item.applied)
  if (summary.length && options.dry) {
    console.log(`\n${summary.length} files would be updated by button-to-ds-variants.`)
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  await apply(options)
}

run().catch((error) => {
  console.error("button-to-ds-variants failed", error)
  process.exitCode = 1
})
