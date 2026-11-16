import {
  flowmarkAgentPrompt,
  instrumentationGuideUrl,
} from "../../onboarding/agent-prompt"

export { flowmarkAgentPrompt, instrumentationGuideUrl }

export function npmInstallCommand(): string {
  return "npm i @flowmarkdev/node"
}

export function serverEnvironmentSnippet(apiOrigin: string): string {
  return `FLOWMARK_API_KEY=<write key>\nFLOWMARK_API_URL=${apiOrigin}`
}

export function manualWorkflowSnippet(apiOrigin: string): string {
  return `${npmInstallCommand()}

${serverEnvironmentSnippet(apiOrigin)}

import { createFlowmark } from "@flowmarkdev/node"

const flowmark = createFlowmark()

export async function importCustomers(batchId: string) {
  const flow = flowmark.workflow("customer.import", {
    properties: { batchId },
  })
  try {
    const imported = await flow.operation("import-batch", async () => {
      // existing application work
      return { imported: 988, skipped: 12 }
    })
    flow.done({
      outcome: "partial",
      result: imported,
    })
    return imported
  } catch (error) {
    flow.fail({ code: "IMPORT_FAILED" })
    throw error
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
