import { Array as EffectArray, Match } from "effect"
import type { RemoteAgentAccessDeployment } from "./agent-access-capability"
import { cursorMcpClientId, cursorMcpConfig } from "./cursor-mcp-client"

type AgentAccessKind = RemoteAgentAccessDeployment["kind"]

export type AgentClientId = "codex" | "cursor" | "claude-code" | "custom"

const connectedGuide = (
  id: AgentClientId,
  mcpUrl: string,
): AgentClientGuide => {
  if (id === "cursor") {
    return {
      id,
      label: "Cursor",
      summary:
        "Cursor uses Streamable HTTP and a pre-registered public client. Dynamic registration stays closed. Studio does not write Cursor's config, and copying this text does not grant access. Vendor compatibility is not a substitute for approving projects. The reference HTTP client remains the automated proof.",
      steps: [
        `Add the endpoint ${mcpUrl} with static OAuth client id ${cursorMcpClientId}. Do not set a client secret or paste an ingestion key.`,
        "Cursor desktop redirects to http://localhost:8787/callback. Cursor on the web uses https://www.cursor.com/agents/mcp/oauth/callback. Both are registered. Custom-scheme callbacks are not accepted.",
        "Sign in and approve only the projects you select on the Studio consent screen.",
        "Call get_connection, then investigate with list_workflows, find_runs, get_run, compare_run, or get_workflow_insights.",
        "Inspect the tool result. A copied snippet does not authorize those calls.",
      ],
      pasteHint: `Copy this into Cursor mcp.json yourself. Flowmark does not write that file.\n${cursorMcpConfig(mcpUrl)}`,
    }
  }
  const label = MatchLabel[id]
  return {
    id,
    label,
    summary: `Inspectable steps for ${label}. Vendor compatibility is not established; the tested path is the reference HTTP client. Studio does not write the client's files, and copying this text does not grant access.`,
    steps: [
      `Register the MCP endpoint ${mcpUrl} in ${label}. Use OAuth; do not paste an ingestion key or a dashboard cookie.`,
      "Approve only the projects you select on the Studio consent screen.",
      "Call get_connection, then investigate with list_workflows, find_runs, get_run, compare_run, or get_workflow_insights. Copying this text does not authorize those calls.",
      "Inspect the tool result. Studio records connection authentication, which does not prove a successful project read.",
      "A saved snippet or a failed copy is not a connection, and it does not mean an agent process is running.",
    ],
    pasteHint:
      "Copy the endpoint into the client yourself. Flowmark does not write a global client configuration.",
  }
}

const MatchLabel: Record<AgentClientId, string> = {
  codex: "Codex",
  cursor: "Cursor",
  "claude-code": "Claude Code",
  custom: "Custom agent",
}

export type AgentClientGuide = {
  readonly id: AgentClientId
  readonly label: string
  readonly summary: string
  readonly steps: readonly string[]
  readonly pasteHint: string
}

export const agentClientOrder: readonly AgentClientId[] = [
  "codex",
  "cursor",
  "claude-code",
  "custom",
]

export type AgentExampleQuestion = {
  readonly id: string
  readonly label: string
  readonly prompt: string
}

export function agentClientGuides(
  mcpUrl?: string,
): readonly AgentClientGuide[] {
  if (mcpUrl) {
    return EffectArray.map(agentClientOrder, (id) => connectedGuide(id, mcpUrl))
  }
  return [
    {
      id: "codex",
      label: "Codex",
      summary:
        "Use Codex in the CLI or IDE you already trust. MCP metadata could not be confirmed, so paste Studio links and copied summaries yourself.",
      steps: [
        "Open Explore or Runs in Studio for the project you are investigating.",
        "Inspect one run, open the Handoff section, and copy the investigation summary.",
        "Paste the summary and Studio link into Codex with a focused question about recorded evidence.",
        "Keep ingestion write keys out of Codex prompts; they belong only in your server environment.",
      ],
      pasteHint:
        "Paste into your Codex workspace as context. Sending a message is deliberate — nothing leaves Studio without your action.",
    },
    {
      id: "cursor",
      label: "Cursor",
      summary:
        "Cursor can reason about copied Flowmark facts alongside your repository when MCP metadata could not be confirmed.",
      steps: [
        "Switch to the correct project in the Studio header before copying anything.",
        "From a run inspector, copy the investigation summary or export JSON you need.",
        "Paste the copied text into Cursor chat until this page shows an MCP endpoint. Do not invent a client secret.",
        "Add your own code inspection; Flowmark reports application telemetry, not verified root cause.",
      ],
      pasteHint:
        "Use Cursor chat or docs in your repo. Do not treat a copied snippet as OAuth authorization or a verified MCP session.",
    },
    {
      id: "claude-code",
      label: "Claude Code",
      summary:
        "Claude Code uses the same manual handoff when MCP metadata could not be confirmed.",
      steps: [
        "Confirm the active Studio project matches the application you are debugging.",
        "Copy a run handoff summary, timeline export, or the example questions below.",
        "Paste into Claude Code with explicit references to the Studio URL you copied.",
        "Never paste server write keys or ingestion secrets into Claude Code sessions.",
      ],
      pasteHint:
        "Paste into your Claude Code session manually while metadata is unconfirmed. Do not guess an endpoint.",
    },
    {
      id: "custom",
      label: "Custom agent",
      summary:
        "Any agent can use the same manual path when MCP metadata could not be confirmed. Authorized evidence stays in Studio until you copy it.",
      steps: [
        "Read project-scoped evidence through Studio until this page confirms the MCP endpoint.",
        "Copy structured exports or the investigation summary from a run you are allowed to view.",
        "Hand the text and dashboard links to your agent; it combines them with code and logs you already trust.",
        "Do not embed dashboard session cookies, write keys, or guessed MCP URLs in shared configuration.",
      ],
      pasteHint:
        "Treat copied text as untrusted application-reported evidence. Your agent still needs explicit user intent to send it onward.",
    },
  ]
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
  const title = "Read evidence with your agent"
  return Match.value(kind).pipe(
    Match.when("enabled", () => ({
      title,
      body: "Remote MCP read access is available on this deployment. Register the endpoint shown below, approve the projects you select, then investigate with the read-only tools. Copying this page does not grant access.",
      separation:
        "Ingestion keys authenticate your application. An MCP connection is a separate read grant. It cannot ingest events, and it is not a dashboard session.",
    })),
    Match.when("unavailable", () => ({
      title,
      body: "Remote MCP could not be confirmed for this deployment. Retry the check before registering a client. Copied instructions are not a connection.",
      separation:
        "Ingestion keys stay separate from agent read access. Do not guess an MCP endpoint.",
    })),
    Match.exhaustive,
  )
}

export function connectPageDescription(kind: AgentAccessKind): string {
  return Match.value(kind).pipe(
    Match.when(
      "enabled",
      () =>
        "Instrument your application, then investigate with the MCP read tools when this page shows an endpoint. Ingestion keys, copied setup, and an MCP grant stay separate. None of them is authorization by itself.",
    ),
    Match.when(
      "unavailable",
      () =>
        "Instrument your application, then read evidence in Studio until this page confirms MCP metadata. Ingestion keys and copied handoff text do not create an OAuth connection.",
    ),
    Match.exhaustive,
  )
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
