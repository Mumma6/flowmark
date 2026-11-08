import { Array as EffectArray } from "effect"

export type AgentClientId = "codex" | "cursor" | "claude-code" | "custom"

const connectedGuide = (
  id: AgentClientId,
  mcpUrl: string,
): AgentClientGuide => {
  const label = MatchLabel[id]
  return {
    id,
    label,
    summary: `Inspectable steps for ${label}. Vendor compatibility is not established; the tested path is the reference HTTP client. Studio does not edit the client's files, and copying this text does not grant access.`,
    steps: [
      `Register the MCP endpoint ${mcpUrl} in ${label}. Use OAuth; do not paste an ingestion key or a dashboard cookie.`,
      "Approve only the projects you select on the Studio consent screen.",
      "After that client completes an authorized read, return here. Access verified appears only from that read.",
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
        "Use Codex in the CLI or IDE you already trust. Flowmark does not connect automatically — you paste Studio links and copied summaries yourself.",
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
        "Cursor can reason about copied Flowmark facts alongside your repository. Remote MCP registration is not available on this deployment yet.",
      steps: [
        "Switch to the correct project in the Studio header before copying anything.",
        "From a run inspector, copy the investigation summary or export JSON you need.",
        "Paste the copied text into Cursor chat or a scratch file in your repo — not into client MCP config expecting a live connection.",
        "Add your own code inspection; Flowmark reports application telemetry, not verified root cause.",
      ],
      pasteHint:
        "Use Cursor chat or docs in your repo. Do not treat a copied snippet as OAuth authorization or a verified MCP session.",
    },
    {
      id: "claude-code",
      label: "Claude Code",
      summary:
        "Claude Code works the same way: manual evidence handoff from Studio until remote read tools are enabled.",
      steps: [
        "Confirm the active Studio project matches the application you are debugging.",
        "Copy a run handoff summary, timeline export, or the example questions below.",
        "Paste into Claude Code with explicit references to the Studio URL you copied.",
        "Never paste server write keys or ingestion secrets into Claude Code sessions.",
      ],
      pasteHint:
        "Paste into your Claude Code session manually. /mcp registration and OAuth are unavailable until this environment enables them.",
    },
    {
      id: "custom",
      label: "Custom agent",
      summary:
        "Any MCP-compatible or plain-text agent can use the same manual path: authorized evidence stays in Studio until you copy it.",
      steps: [
        "Read project-scoped evidence only through Studio while remote tools are disabled.",
        "Copy structured exports or the investigation summary from a run you are allowed to view.",
        "Hand the text and dashboard links to your agent; it combines them with code and logs you already trust.",
        "Do not embed dashboard session cookies, write keys, or guessed MCP URLs in shared configuration.",
      ],
      pasteHint:
        "Treat copied text as untrusted application-reported evidence. Your agent still needs explicit user intent to send it onward.",
    },
  ]
}

export function agentExampleQuestions(
  projectName: string | null,
): readonly AgentExampleQuestion[] {
  const project = projectName ?? "this project"
  return [
    {
      id: "explain-run",
      label: "Explain one run",
      prompt: `For ${project}, explain this run's reported outcome using only Flowmark evidence I paste. Compare its operations with suitable peers and separate observed facts from hypotheses.`,
    },
    {
      id: "failure-code",
      label: "Failure-code increase",
      prompt: `For ${project}, which recorded runs account for the increase in this failure code during the UTC window I specify? Cite Flowmark run links and distinguish missing telemetry from failure.`,
    },
    {
      id: "workflow-change",
      label: "Workflow result change",
      prompt: `For ${project}, what changed in this workflow's declared business results between the two UTC periods I provide? Respect Flowmark coverage limits and do not invent history Flowmark did not retain.`,
    },
  ]
}

export function manualEvidenceHandoffIntro(
  projectName: string | null,
  studioOrigin: string,
): string {
  const project = projectName ?? "the selected project"
  return [
    "Flowmark manual evidence handoff",
    `Project: ${project}`,
    `Studio: ${studioOrigin}`,
    "Steps:",
    `1. Open ${studioOrigin}/explore or ${studioOrigin}/runs while signed in.`,
    "2. Open one run → Handoff → copy the investigation summary.",
    "3. Paste the summary here and ask a focused question.",
    "Application-reported evidence only. Business correctness is not verified by Flowmark.",
  ].join("\n")
}

export function agentAccessIntroCopy(): {
  readonly title: string
  readonly body: string
  readonly separation: string
} {
  return {
    title: "Read evidence with your agent",
    body: "Agent access is read-only investigation help. Your agent combines copied Flowmark facts with code and logs you already trust. It does not receive ingestion write keys or dashboard session cookies from this page.",
    separation:
      "Ingestion keys authenticate your application. Agent reading stays separate until you deliberately copy evidence or enable remote tools in a future release.",
  }
}
