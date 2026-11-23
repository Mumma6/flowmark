import { describe, expect, it } from "vitest"
import {
  CURSOR_AGENT_ENTRY_PATH,
  decideAgentEntry,
  mergeAgentEntryInstruction,
  renderAgentEntryInstruction,
  renderCursorAgentEntryRule,
  renderDecisionSummary,
  buildNodeBootstrapPrPlan,
} from "../src/index.js"

const scope = {
  projectId: "00000000-0000-4000-8000-000000000001",
  repository: "example/bookings",
  service: "worker",
  environment: "staging",
  mcpOrigin: "https://api.flowmark.dev/mcp",
  capabilities: { question: true, repair: false },
}

const citation = "https://studio.flowmark.dev/runs/citation#sample"

describe("agent entry for planning and review", () => {
  it("checks a ticket and a diff on Cursor, then carries only a citation", () => {
    const planning = decideAgentEntry({
      host: "cursor",
      session: "planning",
      change: "consequential",
      grant: "authorized",
      citationUrl: citation,
    })
    const review = decideAgentEntry({
      host: "cursor",
      session: "review",
      change: "consequential",
      grant: "authorized",
      citationUrl: citation,
    })
    expect(planning).toMatchObject({
      trigger: "cursor-rule",
      state: "checked",
      claim: "citation-only",
      tools: ["context_for_change", "explain_execution"],
    })
    expect(planning.reason).toContain("ticket")
    expect(review.reason).toContain("diff")
    const summary = renderDecisionSummary(review)
    expect(summary).toContain(citation)
    expect(summary).not.toMatch(/payload|hmac-sha256|bookingRef/i)
  })

  it("skips docs-only work, denies a revoked grant and withholds facts from other hosts and failed reads", () => {
    expect(
      decideAgentEntry({
        host: "cursor",
        session: "review",
        change: "docs-only",
        grant: "authorized",
        citationUrl: citation,
      }),
    ).toMatchObject({
      trigger: "cursor-rule",
      state: "deliberately-skipped",
      claim: "none",
      citationUrl: null,
    })
    expect(
      decideAgentEntry({
        host: "cursor",
        session: "planning",
        change: "consequential",
        grant: "revoked",
      }),
    ).toMatchObject({ state: "denied", claim: "none", tools: [] })
    expect(
      decideAgentEntry({
        host: "cursor",
        session: "planning",
        change: "consequential",
        grant: "read-failed",
      }).reason,
    ).toContain("No production fact")
    expect(
      decideAgentEntry({
        host: "other",
        session: "review",
        change: "consequential",
        grant: "authorized",
        citationUrl: citation,
      }),
    ).toMatchObject({
      trigger: "unsupported-host",
      state: "unavailable",
      citationUrl: null,
    })
  })

  it("installs the Cursor rule and preserves unrelated repository instructions on update", () => {
    const instruction = renderAgentEntryInstruction(scope)
    const rule = renderCursorAgentEntryRule(scope)
    expect(rule).toContain("alwaysApply: true")
    expect(rule).toContain("Repair proposals are not available")
    const first = mergeAgentEntryInstruction(
      "# Repository\n\nKeep the release checklist.\n",
      instruction,
    )
    const revised = renderAgentEntryInstruction({
      ...scope,
      capabilities: { question: true, repair: true },
    })
    const second = mergeAgentEntryInstruction(first, revised)
    expect(second).toContain("Keep the release checklist.")
    expect(second).toContain("Repair proposals are available")
    expect(second.match(/flowmark:agent-entry/g)).toHaveLength(2)
    expect(second.indexOf("Keep the release checklist.")).toBeLessThan(
      second.indexOf("flowmark:agent-entry"),
    )
    const plan = buildNodeBootstrapPrPlan({
      projectId: scope.projectId,
      installationId: "00000000-0000-4000-8000-000000000002",
      bindingId: "00000000-0000-4000-8000-000000000003",
      repository: scope.repository,
      service: scope.service,
      environment: scope.environment,
      policy: {
        allowedNamespaces: [{ kind: "entity", namespace: "booking" }],
        retentionDays: 30,
        maxEventBytes: 4096,
        maxOverheadMs: 10,
        maxEventsPerMinute: 60,
        allowRawPayloads: false,
      },
      coldStartStatus: "pending-deployment-receipt",
      apiOrigin: "https://api.flowmark.dev",
      mcpOrigin: scope.mcpOrigin,
      existingInstructions: "# Owners\n\nDo not rewrite this note.\n",
    })
    expect(plan.files.map((file) => file.path)).toContain(
      CURSOR_AGENT_ENTRY_PATH,
    )
    expect(
      plan.files.find((file) => file.path === "AGENTS.md")?.content,
    ).toContain("Do not rewrite this note.")
  })
})
