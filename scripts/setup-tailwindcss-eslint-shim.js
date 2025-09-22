#!/usr/bin/env node
 
const { writeFile, access, readFile } = require("node:fs/promises")
const path = require("node:path")
const targetPath = path.join(process.cwd(), "node_modules", "tailwindcss", "resolveConfig.js")
const packageJsonPath = path.join(process.cwd(), "node_modules", "tailwindcss", "package.json")

async function ensureShim() {
  let shimCreated = false
  try {
    await access(targetPath)
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error
    }
    const contents = `module.exports = function resolveConfig(config) {\n  return config || {};\n};\n`
    await writeFile(targetPath, contents, "utf8")
    console.log("[tailwindcss] Added resolveConfig shim for eslint-plugin-tailwindcss")
    shimCreated = true
  }

  const pkgRaw = await readFile(packageJsonPath, "utf8")
  const pkg = JSON.parse(pkgRaw)
  pkg.exports = pkg.exports || {}
  if (!pkg.exports["./resolveConfig"]) {
    pkg.exports["./resolveConfig"] = "./resolveConfig.js"
  }
  if (!pkg.exports["./resolveConfig.js"]) {
    pkg.exports["./resolveConfig.js"] = "./resolveConfig.js"
  }
  await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8")
  if (!shimCreated) {
    console.log("[tailwindcss] ensure resolveConfig exports for eslint-plugin-tailwindcss")
  }
}

ensureShim().catch((error) => {
  console.error("Failed to create tailwindcss resolveConfig shim", error)
  process.exitCode = 1
})
