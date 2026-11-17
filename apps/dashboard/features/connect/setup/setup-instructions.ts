import {
  flowmarkAgentPrompt,
  instrumentationGuideUrl,
} from "../../onboarding/agent-prompt"

export { flowmarkAgentPrompt, instrumentationGuideUrl }

export function npmInstallCommand(): string {
  return "npm i @flowmarkdev/node"
}

export function serverEnvironmentSnippet(apiOrigin: string): string {
  return apiOrigin === "https://api.flowmark.dev"
    ? "FLOWMARK_API_KEY=<write key>"
    : `FLOWMARK_API_KEY=<write key>\nFLOWMARK_API_URL=${apiOrigin}`
}

export function manualWorkflowSnippet(apiOrigin: string): string {
  const configuration =
    apiOrigin === "https://api.flowmark.dev"
      ? "Set FLOWMARK_API_KEY in your server environment."
      : `Set FLOWMARK_API_KEY and FLOWMARK_API_URL=${apiOrigin} in your server environment.`
  return `// Node.js only. ${configuration}
// For Next.js, use @flowmarkdev/node/next with automatic delivery instead.
import { createFlowmark } from "@flowmarkdev/node"

const flowmark = createFlowmark()

// importBatch is your existing application function, not a Flowmark API.
export async function importCustomers(batchId: string) {
  try {
    return await flowmark.workflow("customer.import", async (flow) => {
      const imported = await flow.operation("import-batch", () => importBatch(batchId))
      flow.done({
        outcome: imported.skipped > 0 ? "partial" : "complete",
        result: { imported: imported.imported, skipped: imported.skipped },
      })
      return imported
    }, { properties: { batchId } })
  } finally {
    try {
      await flowmark.flush()
    } catch (error) {
      console.error("Flowmark delivery failed", error)
    }
  }
}`
}

export function setupRecoveryCopy(
  apiOrigin: string,
  projectName: string | null,
): {
  readonly copyFailure: string
  readonly lostKey: string
  readonly wrongProject: string
  readonly wrongOrigin: string
} {
  const project = projectName ?? "the selected project"
  return {
    copyFailure:
      "If copy fails, select the code block text and copy it manually, or check browser clipboard permissions.",
    lostKey:
      "Flowmark shows a write key only once when it is created or rotated. Create a new write key in Settings → Ingestion keys and update your server environment.",
    wrongProject: `Ingestion keys belong to one project. Confirm the Studio header shows ${project}, then use a write key from Settings → Ingestion keys for that project.`,
    wrongOrigin: `Studio generates instructions for ${apiOrigin}. Set FLOWMARK_API_URL to that origin on your server — not /v1/events and not another environment's URL.`,
  }
}
