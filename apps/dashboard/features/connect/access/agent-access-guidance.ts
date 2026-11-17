import { Match } from "effect"
import type { RemoteAgentAccessDeployment } from "./agent-access-capability"

type AgentAccessKind = RemoteAgentAccessDeployment["kind"]
export type AgentClientId = "cursor"
export type AgentClientGuide = {
  readonly id: AgentClientId
  readonly label: string
  readonly summary: string
  readonly steps: readonly string[]
  readonly pasteHint: string
}
export const agentClientOrder: readonly AgentClientId[] = ["cursor"]
export type AgentExampleQuestion = {
  readonly id: string
  readonly label: string
  readonly prompt: string
}

export function agentClientGuides(
  mcpUrl?: string,
): readonly AgentClientGuide[] {
  return [
    {
      id: "cursor",
      label: "Cursor",
      summary: mcpUrl
        ? "Connect Cursor to read your Flowmark evidence alongside your application code."
        : "The MCP endpoint could not be confirmed. Retry, or continue with manual SDK setup.",
      steps: mcpUrl
        ? [
            "Merge the configuration into .cursor/mcp.json in your repository. Create the file if needed.",
            "In Cursor Settings → Tools & MCP, enable flowmark and choose Connect or Sign in.",
            "Sign in to Flowmark in the browser, select this project and allow read access. Return to Cursor.",
          ]
        : [
            "Reload this page to check the endpoint again.",
            "You can install the SDK manually and explore evidence in Studio while the connection is unavailable.",
          ],
      pasteHint:
        "Flowmark does not write your Cursor configuration. Keep write keys out of this file.",
    },
  ]
}

export function cursorConnectionPrompt(
  project: { readonly id: string; readonly name: string } | null,
): string {
  return [
    "Use Flowmark MCP to call get_connection.",
    project
      ? `Confirm access to project ${JSON.stringify(project.name)} (project ID: ${project.id}), then call list_workflows for that project.`
      : "Ask me which authorized project to use, then call list_workflows for it.",
    "Report whether both calls succeeded and whether the project is authorized. An empty workflow list is fine: instrumentation comes next. If access is denied, ask me to reconnect and approve this project. Do not request an ingestion key.",
  ].join("\n")
}

const projectLabel = (projectName: string | null) =>
  projectName ?? "this project"

const manualExampleQuestions = (
  project: string,
  availability: string,
): readonly AgentExampleQuestion[] => [
  {
    id: "explain-run",
    label: "Explain one run",
    prompt: `Remote MCP ${availability}. For ${project}, explain this run's reported outcome using only Flowmark evidence I paste. Compare its operations with suitable peers and separate observed facts from hypotheses. Do not call Flowmark tools.`,
  },
  {
    id: "failure-code",
    label: "Failure-code increase",
    prompt: `Remote MCP ${availability}. For ${project}, which recorded runs account for the increase in this failure code during the UTC window I specify? Cite the Studio run links I paste and distinguish missing telemetry from failure. Do not call Flowmark tools.`,
  },
  {
    id: "workflow-change",
    label: "Workflow result change",
    prompt: `Remote MCP ${availability}. For ${project}, what changed in this workflow's declared business results between the two UTC periods I provide? Use only the Studio evidence I paste, respect coverage limits, and do not invent history Flowmark did not retain.`,
  },
]

export function agentExampleQuestions(
  projectName: string | null,
  kind: AgentAccessKind,
): readonly AgentExampleQuestion[] {
  const project = projectLabel(projectName)
  return Match.value(kind).pipe(
    Match.when("enabled", (): readonly AgentExampleQuestion[] => [
      {
        id: "explain-run",
        label: "Explain one run",
        prompt: `For ${project}, use the authorized Flowmark MCP connection. Call get_connection, then list_workflows for one authorized project. Use find_runs with the UTC window I specify (at most 31 days), then get_run for one returned run. Explain the reported outcome from the tool result and separate facts from hypotheses. Do not paste an ingestion key or invent tools.`,
      },
      {
        id: "failure-code",
        label: "Failure-code increase",
        prompt: `For ${project}, call find_runs for this failure code during the UTC window I specify. Cite the returned run links. Missing telemetry is not the same as a recorded failure.`,
      },
      {
        id: "workflow-change",
        label: "Workflow result change",
        prompt: `For ${project}, call get_workflow_insights for the declared business results across the two UTC periods I provide. Respect the returned coverage limits. Do not invent history the tool did not return.`,
      },
    ]),
    Match.when("unavailable", () =>
      manualExampleQuestions(
        project,
        "could not be confirmed for this deployment",
      ),
    ),
    Match.exhaustive,
  )
}

const manualHandoff = (
  project: string,
  studioOrigin: string,
  availability: string,
) =>
  [
    "Flowmark manual evidence handoff",
    `Project: ${project}`,
    `Studio: ${studioOrigin}`,
    `Remote MCP ${availability}. Do not call Flowmark tools or guess an endpoint.`,
    "Steps:",
    `1. Open ${studioOrigin}/ while signed in, or open ${studioOrigin}/runs.`,
    "2. Open one run, then Handoff, and copy the investigation summary.",
    "3. Paste the summary here and ask a focused question.",
    "Application-reported evidence only. Business correctness is not verified by Flowmark.",
  ].join("\n")

export function manualEvidenceHandoffIntro(
  projectName: string | null,
  studioOrigin: string,
  kind: AgentAccessKind,
): string {
  const project = projectName ?? "the selected project"
  return Match.value(kind).pipe(
    Match.when("enabled", () =>
      [
        "Flowmark MCP investigation",
        `Project: ${project}`,
        `Studio: ${studioOrigin}/`,
        "Remote MCP read tools are available on this deployment. Copying this text does not grant access.",
        "Steps:",
        "1. Register the MCP endpoint shown in Studio. Use OAuth and approve only the projects you select.",
        "2. Call get_connection, then list_workflows for an authorized project.",
        "3. Call find_runs with an explicit UTC window of at most 31 days, then get_run for one run. compare_run and get_workflow_insights are the other read-only tools.",
        "4. Open a returned Studio link when you want the supporting evidence on screen. A link grants no access.",
        "Do not paste an ingestion key, browser key, or dashboard cookie. Business correctness is not verified by Flowmark.",
      ].join("\n"),
    ),
    Match.when("unavailable", () =>
      manualHandoff(
        project,
        studioOrigin,
        "could not be confirmed for this deployment",
      ),
    ),
    Match.exhaustive,
  )
}

export function agentAccessIntroCopy(kind: AgentAccessKind): {
  readonly title: string
  readonly body: string
  readonly separation: string
} {
  const title = "Connect Cursor · recommended"
  return Match.value(kind).pipe(
    Match.when("enabled", () => ({
      title,
      body: "MCP lets Cursor read process evidence alongside your code. Sign in and choose which projects it can read.",
      separation:
        "Cursor edits your code using its own coding tools. The Flowmark SDK sends evidence; MCP reads it.",
    })),
    Match.when("unavailable", () => ({
      title,
      body: "The Cursor connection could not be confirmed for this environment. Retry the check or continue with manual SDK setup.",
      separation:
        "Your application can still report evidence through the SDK. Use the endpoint shown here when the connection is available.",
    })),
    Match.exhaustive,
  )
}

export function connectPageDescription(): string {
  return "Connect Cursor, add the SDK and explore your first execution. Manual setup is available below."
}

export function agentHandoffPresentation(kind: AgentAccessKind): {
  readonly title: string
  readonly description: string
  readonly questions: string
  readonly clients: string
} {
  return Match.value(kind).pipe(
    Match.when("enabled", () => ({
      title: "MCP investigation",
      description:
        "Use the read-only tools on an authorized connection. Copying this checklist does not grant access or start an agent.",
      questions:
        "Starter prompts for an authorized MCP connection. They name the existing read-only tools. Copying a prompt does not grant access.",
      clients:
        "Use the endpoint for this environment. Copying it does not write your client configuration or grant access.",
    })),
    Match.when("unavailable", () => ({
      title: "Manual evidence handoff",
      description:
        "Remote MCP could not be confirmed for this deployment. Open Studio, copy a factual summary, and paste it into your agent.",
      questions:
        "Starter prompts for manual paste. Remote MCP could not be confirmed for this deployment.",
      clients:
        "Remote MCP could not be confirmed for this deployment. Copy guidance into the surface you already use; nothing here registers OAuth or stores a connection.",
    })),
    Match.exhaustive,
  )
}
