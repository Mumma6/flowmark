import { Match, Result, Schema } from "effect"

export const AGENT_ENTRY_START = "<!-- flowmark:agent-entry -->"
export const AGENT_ENTRY_END = "<!-- /flowmark:agent-entry -->"
export const CURSOR_AGENT_ENTRY_PATH =
  ".cursor/rules/flowmark-runtime-memory.mdc"
export const REPOSITORY_INSTRUCTION_PATH = "AGENTS.md"

export const AgentEntryHostSchema = Schema.Literals(["cursor", "other"])
export type AgentEntryHost = typeof AgentEntryHostSchema.Type

export const AgentEntrySessionSchema = Schema.Literals(["planning", "review"])
export type AgentEntrySession = typeof AgentEntrySessionSchema.Type

export const AgentEntryChangeSchema = Schema.Literals([
  "consequential",
  "docs-only",
])
export type AgentEntryChange = typeof AgentEntryChangeSchema.Type

export const AgentEntryGrantSchema = Schema.Literals([
  "authorized",
  "revoked",
  "read-failed",
])
export type AgentEntryGrant = typeof AgentEntryGrantSchema.Type

export const AgentEntryTriggerSchema = Schema.Literals([
  "cursor-rule",
  "unsupported-host",
])
export type AgentEntryTrigger = typeof AgentEntryTriggerSchema.Type

export const AgentEntryStateSchema = Schema.Literals([
  "checked",
  "deliberately-skipped",
  "denied",
  "unavailable",
])
export type AgentEntryState = typeof AgentEntryStateSchema.Type

export const AgentEntryCapabilitiesSchema = Schema.Struct({
  question: Schema.Boolean,
  repair: Schema.Boolean,
})
export type AgentEntryCapabilities = typeof AgentEntryCapabilitiesSchema.Type

const CitationUrl = Schema.String.check(
  Schema.isMinLength(8),
  Schema.isMaxLength(256),
  Schema.makeFilter((value) => {
    try {
      const parsed = new URL(value)
      return (
        parsed.protocol === "https:" && !parsed.username && !parsed.password
      )
    } catch {
      return false
    }
  }),
)

export const AgentEntryDecisionSchema = Schema.Struct({
  session: AgentEntrySessionSchema,
  trigger: AgentEntryTriggerSchema,
  state: AgentEntryStateSchema,
  reason: Schema.String.check(Schema.isMaxLength(400)),
  tools: Schema.Array(
    Schema.Literals(["context_for_change", "explain_execution"]),
  ).check(Schema.isMaxLength(2)),
  claim: Schema.Literals(["none", "citation-only"]),
  citationUrl: Schema.NullOr(CitationUrl),
})
export type AgentEntryDecision = typeof AgentEntryDecisionSchema.Type

export interface AgentEntryScope {
  readonly projectId: string
  readonly repository: string
  readonly service: string
  readonly environment: string
  readonly mcpOrigin: string
  readonly capabilities: AgentEntryCapabilities
}

export interface AgentEntryInput {
  readonly host: AgentEntryHost
  readonly session: AgentEntrySession
  readonly change: AgentEntryChange
  readonly grant: AgentEntryGrant
  readonly citationUrl?: string | null
}

const sessionLead = (session: AgentEntrySession) =>
  Match.value(session).pipe(
    Match.when("planning", () => "Planning started from the ticket."),
    Match.when("review", () => "Review started from the diff."),
    Match.exhaustive,
  )

const triggerFor = (host: AgentEntryHost): AgentEntryTrigger =>
  Match.value(host).pipe(
    Match.when("cursor", () => "cursor-rule" as const),
    Match.when("other", () => "unsupported-host" as const),
    Match.exhaustive,
  )

const acceptedCitation = (value: string | null | undefined) =>
  Result.getOrElse(
    Schema.decodeUnknownResult(CitationUrl)(value ?? ""),
    () => null,
  )

const decision = (
  input: AgentEntryInput,
  state: AgentEntryState,
  reason: string,
  claim: AgentEntryDecision["claim"],
  citationUrl: string | null,
  tools: AgentEntryDecision["tools"],
): AgentEntryDecision => ({
  session: input.session,
  trigger: triggerFor(input.host),
  state,
  reason,
  tools,
  claim,
  citationUrl,
})

/**
 * Classify one planning or review session. Unsupported hosts, docs-only
 * changes, revoked grants and failed reads never carry a production fact.
 */
export function decideAgentEntry(input: AgentEntryInput): AgentEntryDecision {
  const started = sessionLead(input.session)
  if (input.host === "other") {
    return decision(
      input,
      "unavailable",
      `${started} This host has a repository instruction only, so no production fact is available.`,
      "none",
      null,
      [],
    )
  }
  if (input.change === "docs-only") {
    return decision(
      input,
      "deliberately-skipped",
      `${started} Docs-only change skipped. No production fact applies.`,
      "none",
      null,
      [],
    )
  }
  if (input.grant === "revoked") {
    return decision(
      input,
      "denied",
      `${started} The read grant is revoked. No production fact is available.`,
      "none",
      null,
      [],
    )
  }
  if (input.grant === "read-failed") {
    return decision(
      input,
      "unavailable",
      `${started} The authorized read failed. No production fact is available.`,
      "none",
      null,
      [],
    )
  }
  const citationUrl = acceptedCitation(input.citationUrl)
  return decision(
    input,
    "checked",
    `${started} Consulted context_for_change and can expand a cited case with explain_execution.`,
    citationUrl ? "citation-only" : "none",
    citationUrl,
    ["context_for_change", "explain_execution"],
  )
}

const capabilityLines = (capabilities: AgentEntryCapabilities) =>
  [
    capabilities.question
      ? "- Question checks are available. Use the repository fixture and an authorized read before treating a distinction as ready."
      : "- Question checks are not advertised for this installation.",
    capabilities.repair
      ? "- Repair proposals are available. Keep the smallest observation change in the feature PR."
      : "- Repair proposals are not available yet. Do not invent an instrumentation repair.",
    "- Boundary discovery is available through `discover_boundaries`. It reconciles source registrations with the deployment inventory and does not read a telemetry feed.",
  ].join("\n")

export function renderAgentEntryInstruction(scope: AgentEntryScope): string {
  return [
    "# Flowmark runtime evidence",
    "",
    `Installation scope: project \`${scope.projectId}\`, repository \`${scope.repository}\`, service \`${scope.service}\`, environment \`${scope.environment}\`.`,
    `MCP reads: \`${scope.mcpOrigin}\`.`,
    "",
    "Cursor loads `.cursor/rules/flowmark-runtime-memory.mdc` automatically. That rule is the exercised trigger. Other hosts keep this repository instruction and must treat invocation as unavailable.",
    "",
    "Planning starts from the ticket. Review starts from the diff. When retained runtime evidence could change the decision, call `context_for_change` with this repository and project. Expand a cited case with `explain_execution` and the returned run id. Carry only the citation URL and the sanitized decision summary into the pull request.",
    "",
    "Record one state:",
    "- `checked` — the tool call ran under the current grant.",
    "- `deliberately-skipped` — a docs-only change, or evidence cannot change the patch.",
    "- `denied` — the grant is revoked or missing.",
    "- `unavailable` — the host cannot run the trigger, or the read failed.",
    "",
    "Skipped, denied and unavailable states include no production fact.",
    capabilityLines(scope.capabilities),
    "Never read, print or commit `FLOWMARK_API_KEY`, `FLOWMARK_REFERENCE_KEY` or `FLOWMARK_DEPLOYMENT_TOKEN`.",
  ].join("\n")
}

export function renderCursorAgentEntryRule(scope: AgentEntryScope): string {
  return [
    "---",
    "description: Consult Flowmark runtime evidence during planning and review",
    "alwaysApply: true",
    "---",
    "",
    renderAgentEntryInstruction(scope),
    "",
  ].join("\n")
}

export function mergeAgentEntryInstruction(
  existing: string,
  instruction: string,
): string {
  const wrapped = `${AGENT_ENTRY_START}\n${instruction.trim()}\n${AGENT_ENTRY_END}\n`
  const start = existing.indexOf(AGENT_ENTRY_START)
  const end = existing.indexOf(AGENT_ENTRY_END)
  if (start >= 0 && end > start) {
    const after = existing
      .slice(end + AGENT_ENTRY_END.length)
      .replace(/^\n/, "")
    return `${existing.slice(0, start)}${wrapped}${after}`
  }
  const preserved = existing.trimEnd()
  return preserved.length === 0 ? wrapped : `${preserved}\n\n${wrapped}`
}

export function renderDecisionSummary(decision: AgentEntryDecision): string {
  const citation =
    decision.claim === "citation-only" && decision.citationUrl
      ? `Citation: ${decision.citationUrl}`
      : "Citation: none"
  return [
    "<!-- flowmark:decision -->",
    `Session: ${decision.session}`,
    `Trigger: ${decision.trigger}`,
    `State: ${decision.state}`,
    `Claim: ${decision.claim}`,
    decision.reason,
    citation,
    "<!-- /flowmark:decision -->",
  ].join("\n")
}
