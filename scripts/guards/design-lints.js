#!/usr/bin/env node
 
const { readdir, readFile } = require("node:fs/promises")
const { existsSync } = require("node:fs")
const path = require("node:path")

const root = process.cwd()
const includeDirs = [
  path.join("components", "sections"),
  path.join("components", "pricing"),
  path.join("components", "marketing"),
  path.join("components", "diagnostic"),
]
const ignoredDirs = new Set(["node_modules", ".next", "storybook-static", ".git"])
const validExtensions = new Set([".ts", ".tsx", ".css", ".scss", ".mdx", ".jsx"])
const ignoredPathFragments = [
  path.join("components", "marketing", "forms"),
  path.join("components", "marketing", "navigation"),
]

const hexPattern = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const arbitraryValuePattern = /\[[^\]]*(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|px)/g

async function collectFiles() {
  const files = []

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      if (ignoredDirs.has(entry.name)) continue
      const absolutePath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(absolutePath)
        continue
      }
      const ext = path.extname(entry.name)
      if (!validExtensions.has(ext)) continue
      files.push(absolutePath)
    }
  }

  for (const dir of includeDirs) {
    const absoluteDir = path.join(root, dir)
    if (existsSync(absoluteDir)) {
      await walk(absoluteDir)
    }
  }

  return files
}

function isAllowed(match) {
  const lower = match.toLowerCase()
  if (lower === "#000" || lower === "#fff") return true
  return false
}

async function run() {
  const files = await collectFiles()
  const violations = []

  for (const file of files) {
    const contents = await readFile(file, "utf8")
    const relative = path.relative(root, file)
    if (ignoredPathFragments.some((fragment) => relative.includes(fragment))) {
      continue
    }

    const hexMatches = contents.match(hexPattern) ?? []
    for (const match of hexMatches) {
      if (isAllowed(match)) continue
      violations.push({ file: relative, type: "hex", value: match })
    }

    const arbitraryMatches = contents.match(arbitraryValuePattern) ?? []
    for (const match of arbitraryMatches) {
      violations.push({ file: relative, type: "arbitrary", value: match })
    }
  }

  if (violations.length > 0) {
    console.error("Design lint violations detected:\n")
    for (const violation of violations) {
      console.error(`- [${violation.type}] ${violation.value} → ${violation.file}`)
    }
    console.error("\nResolve the violations above or update the guard allow list.")
    process.exitCode = 1
    return
  }

  console.log("Design lint guard passed — no raw hex or arbitrary Tailwind values detected.")
}

run().catch((error) => {
  console.error("design lint guard failed", error)
  process.exitCode = 1
})
