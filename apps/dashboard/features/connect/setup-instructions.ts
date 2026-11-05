import {
  flowmarkAgentPrompt,
  instrumentationGuideUrl,
} from "../onboarding/agent-prompt"

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

export const flowmark = createFlowmark()

const flow = flowmark.workflow("example.process")
flow.step("started")
await flow.operation("work", async () => {
  // existing application work
})
flow.done({ result: { ok: true } })`
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
