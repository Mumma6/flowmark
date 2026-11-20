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

export const manualWorkflowSnippet = `// lib/flowmark.ts (server only)
import { createFlowmark } from "@flowmarkdev/node/next"

export const flowmark = createFlowmark()

// In your existing Node.js Route Handler or Server Action:
// Import flowmark from lib/flowmark and wrap your existing importInvoices call.
const result = await flowmark.workflow("invoice.import", () => importInvoices())`

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
