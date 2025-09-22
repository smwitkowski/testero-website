import { parseArgs, type CodemodCLIOptions } from "./utils"
import { apply as removeLocalDesignTokens } from "./remove-local-designTokens"
import { apply as wrapWithContainerSection } from "./wrap-with-container-section"
import { apply as buttonToDsVariants } from "./button-to-ds-variants"
import { apply as badgeAndStatus } from "./badge-and-status"
import { apply as hexToSemantic } from "./hex-to-semantic"

const codemods: { name: string; run: (options: CodemodCLIOptions) => Promise<void> }[] = [
  { name: "remove-local-designTokens", run: removeLocalDesignTokens },
  { name: "wrap-with-container-section", run: wrapWithContainerSection },
  { name: "button-to-ds-variants", run: buttonToDsVariants },
  { name: "badge-and-status", run: badgeAndStatus },
  { name: "hex-to-semantic", run: hexToSemantic },
]

async function run() {
  const options = parseArgs(process.argv.slice(2))

  for (const codemod of codemods) {
    console.log(`\n▶ Running ${codemod.name}${options.dry ? " (dry run)" : ""}`)
    await codemod.run(options)
  }

  console.log("\n✅ Design system codemods completed")
}

run().catch((error) => {
  console.error("codemod orchestrator failed", error)
  process.exitCode = 1
})
