import { Array as EffectArray, Option, pipe } from "effect"
import type {
  RouterInputs,
  RouterOutputs,
  RunEvent,
} from "../platform/api-types"
import {
  explorerDefaults,
  explorerFilterLabels,
  type ExplorerFilters,
} from "./explorer-filters"
import { investigationReturn } from "./investigation-navigation"
import { terminalEvidence } from "./run-state"

export type SafeRunContextInput = {
  readonly projectId: string
  readonly projectName: string
  readonly runPath: string
  readonly sourceFrom: string | null
  readonly filters: ExplorerFilters
  readonly returnUrl?: string | null
}

export type SafeRunContextHandoff = {
  readonly preview: string
  readonly omissions: readonly string[]
}

const defaultOmissions = [
  "Failure message text (use failure code and Studio evidence instead)",
  "Raw event and result JSON bodies",
  "Business reference values, search text, and filtered result values from source selection",
  "Ingestion credentials, API keys, and dashboard session cookies",
] as const

function manualHandoffHeader(): readonly string[] {
  return [
    "Flowmark investigation context (manual handoff)",
    "Remote MCP read tools are not used on this deployment. Paste this text deliberately and open the evidence link — do not instruct an agent to call unavailable Flowmark tools.",
    "",
  ]
}

function finalizeHandoff(
  bodyLines: readonly string[],
  extraOmissions: readonly string[] = [],
): SafeRunContextHandoff {
  const omissions = EffectArray.fromIterable(
    new Set([...defaultOmissions, ...extraOmissions]),
  )
  const preview = [
    ...manualHandoffHeader(),
    ...bodyLines,
    "",
    "Intentionally omitted from this handoff:",
    ...omissions.map((item) => `- ${item}`),
    "",
    "Application-reported evidence. Business correctness and root cause are not verified by Flowmark.",
  ].join("\n")
  return { preview, omissions }
}

function utcWindowDescription(filters: ExplorerFilters): string | null {
  const after =
    filters.startedAfterExact ||
    (filters.startedAfter ? `${filters.startedAfter}T00:00:00.000Z` : "")
  const before =
    filters.startedBeforeExact ||
    filters.startedBeforeExclusive ||
    (filters.startedBefore ? `${filters.startedBefore}T23:59:59.999Z` : "")
  if (!after && !before) {
    return null
  }
  return [
    "Half-open UTC bounds from source selection:",
    after ? `  startedAfter: ${after}` : "  startedAfter: (open)",
    before ? `  startedBefore: ${before}` : "  startedBefore: (open)",
  ].join("\n")
}

function redactedFilterLine(
  key: keyof ExplorerFilters,
  value: string,
): { readonly line: string | null; readonly omission: string | null } {
  if (key === "businessValue" && value) {
    return {
      line: null,
      omission: "Business reference value from source selection",
    }
  }
  if (key === "businessKey" && value) {
    return {
      line: `${explorerFilterLabels.businessKey}: ${value} (value omitted)`,
      omission: null,
    }
  }
  if (key === "search" && value.trim()) {
    return { line: null, omission: "Explore search text from source selection" }
  }
  if (key === "resultValue" && value) {
    return {
      line: `${explorerFilterLabels.resultPath}: filter applied (matched value omitted)`,
      omission: "Result filter value from source selection",
    }
  }
  if (key === "resultReason" && value) {
    return {
      line: null,
      omission: "Result reason text from source selection",
    }
  }
  return {
    line: `${explorerFilterLabels[key]}: ${value}`,
    omission: null,
  }
}

export function summarizeSourceSelection(
  filters: ExplorerFilters,
  sourceFrom: string | null,
  studioOrigin: string,
): {
  readonly sourceLabel: string
  readonly sourceUrl: string | null
  readonly utcWindow: string | null
  readonly filterLines: readonly string[]
  readonly omissions: readonly string[]
} {
  const source = sourceFrom
    ? investigationReturn(sourceFrom)
    : { href: "/runs", label: "All runs" }
  const sourceUrl = source.href.startsWith("/")
    ? `${studioOrigin}${source.href}`
    : null
  const filterLines: string[] = []
  const omissionSet = new Set<string>()
  EffectArray.forEach(
    EffectArray.fromIterable(
      Object.keys(explorerDefaults) as Array<keyof ExplorerFilters>,
    ),
    (key) => {
      const value = filters[key]
      const fallback = explorerDefaults[key]
      if (value === fallback || value === "") {
        return
      }
      const redacted = redactedFilterLine(key, value)
      if (redacted.line) {
        filterLines.push(redacted.line)
      }
      if (redacted.omission) {
        omissionSet.add(redacted.omission)
      }
    },
  )
  return {
    sourceLabel: source.label,
    sourceUrl,
    utcWindow: utcWindowDescription(filters),
    filterLines,
    omissions: EffectArray.fromIterable(omissionSet),
  }
}

/** Previewable agent context: factual summary only, not buildRunExport. */
export function buildSafeRunContextHandoff(
  events: readonly RunEvent[],
  input: SafeRunContextInput,
  studioOrigin: string,
): Option.Option<SafeRunContextHandoff> {
  return pipe(
    EffectArray.head(events),
    Option.map((first) => {
      const selection = summarizeSourceSelection(
        input.filters,
        input.sourceFrom,
        studioOrigin,
      )
      const { state, failure, completed } = terminalEvidence(events)
      const terminal = failure ?? completed
      return finalizeHandoff(
        [
          `Project: ${input.projectName} (id: ${input.projectId})`,
          "Entry: Run inspector → Take findings forward",
          `Source selection: ${selection.sourceLabel}${
            selection.sourceUrl ? `\n${selection.sourceUrl}` : ""
          }`,
          selection.utcWindow ?? "UTC window: not narrowed in source selection",
          ...(selection.filterLines.length
            ? [
                "Applied filters:",
                ...selection.filterLines.map((line) => `  ${line}`),
              ]
            : []),
          "",
          `Workflow: ${first.workflow}`,
          `Run external ID: ${first.externalId}`,
          `Run evidence: ${input.runPath}`,
          input.returnUrl
            ? `Studio return (same signed-in project; the link grants no access): ${input.returnUrl}`
            : "Studio return: open the evidence link in the signed-in project",
          `Execution status: ${state === "Running" ? "No final outcome recorded" : state}`,
          `Started (application timestamp): ${first.timestamp}`,
          `Environment: ${first.environment ?? "Not recorded"}`,
          `Release: ${first.release ?? "Not recorded"}`,
          `Correlation ID: ${first.correlationId ?? "Not recorded"}`,
          `Parent run ID: ${first.parentRunId ?? "Not recorded"}`,
          `Failure code: ${failure?.error?.code ?? "Not recorded"}`,
          `Reported outcome label: ${terminal?.outcome ?? "Not recorded"}`,
          `Recorded events: ${events.length}`,
        ],
        selection.omissions,
      )
    }),
  )
}

export type SafeFailureGroupInput = {
  readonly projectId: string
  readonly projectName: string
  readonly sourcePath: string
  readonly currentStartedAfter: string
  readonly currentStartedBefore: string
  readonly previousStartedAfter: string
  readonly previousStartedBefore: string
  readonly workflow: string
  readonly code: string
  readonly currentCount: number
  readonly previousCount: number
  readonly countDelta: number
  readonly matchingRunsPath: string
  readonly truncated: boolean
}

export function buildSafeFailureGroupHandoff(
  input: SafeFailureGroupInput,
  studioOrigin: string,
): SafeRunContextHandoff {
  const extraOmissions = input.truncated
    ? ["Failure groups beyond the displayed Issues table"]
    : []
  return finalizeHandoff(
    [
      `Project: ${input.projectName} (id: ${input.projectId})`,
      "Entry: Issues → failure group (derived cohort, not a persistent issue ID)",
      `Source selection: Issues\n${studioOrigin}${input.sourcePath}`,
      "Current period (half-open UTC, runs started):",
      `  startedAfter: ${input.currentStartedAfter}`,
      `  startedBefore: ${input.currentStartedBefore}`,
      "Previous comparison period (half-open UTC):",
      `  startedAfter: ${input.previousStartedAfter}`,
      `  startedBefore: ${input.previousStartedBefore}`,
      "",
      `Workflow: ${input.workflow}`,
      `Failure code: ${input.code || "No failure code recorded"}`,
      `Failures this window: ${input.currentCount} (${input.countDelta >= 0 ? "+" : ""}${input.countDelta} vs previous ${input.previousCount})`,
      `Matching runs cohort: ${studioOrigin}${input.matchingRunsPath}`,
      "",
      "Suggested question: Which recorded runs account for this failure code during the current UTC window?",
      "",
      "Limitations:",
      "- No issue assignment, resolution, or stored issue identifier exists in Flowmark",
      input.truncated
        ? "- The Issues table shows only the largest groups in this window"
        : "- Exact cohort uses workflow, failure code, and the UTC window above — not a broader fallback query",
    ].filter((line): line is string => Boolean(line)),
    extraOmissions,
  )
}

export type SafeInsightHandoffInput = {
  readonly projectId: string
  readonly projectName: string
  readonly sourcePath: string
  readonly workflow: string
  readonly validDates: boolean
  readonly revision: string
  readonly fieldLabel: string | undefined
  readonly input: RouterInputs["project"]["businessInsights"]
  readonly releaseComparison: RouterOutputs["project"]["businessInsights"]["releaseComparison"]
  readonly currentWindow?: RouterOutputs["project"]["businessInsights"]["windows"][number]
  readonly limitations: readonly string[]
}

export function buildSafeInsightHandoff(
  input: SafeInsightHandoffInput,
  studioOrigin: string,
): SafeRunContextHandoff {
  const omissions: string[] = []
  if (input.input.businessValue) {
    omissions.push("Declared dimension value from outcome selection")
  }
  const ratioSelected =
    (input.input.numerator?.length ?? 0) > 0 &&
    (input.input.denominator?.length ?? 0) > 0
  const lines = [
    `Project: ${input.projectName} (id: ${input.projectId})`,
    "Entry: Insights → reported business outcomes",
    `Source selection: Insights\n${studioOrigin}${input.sourcePath}`,
    !input.validDates
      ? "Limitation: UTC interval invalid or longer than 31 days — business-insights cohort not supported."
      : [
          "Current window (half-open UTC, runs started):",
          `  startedAfter: ${input.input.currentStartedAfter}`,
          `  startedBefore: ${input.input.currentStartedBefore}`,
          "Previous window (half-open UTC):",
          `  startedAfter: ${input.input.previousStartedAfter}`,
          `  startedBefore: ${input.input.previousStartedBefore}`,
        ].join("\n"),
    "",
    `Workflow: ${input.workflow}`,
    `Definition revision: ${input.revision || "not selected"}`,
    `Reported field: ${input.fieldLabel ?? "not selected"}`,
    input.input.businessKey
      ? `Declared dimension: ${input.input.businessKey} (value omitted from handoff)`
      : null,
    ratioSelected
      ? "Ratio selection: numerator and denominator configured — only jointly valid finished runs count"
      : null,
    input.input.releaseA || input.input.releaseB
      ? `Release comparison: A=${input.input.releaseA ?? "—"} · B=${input.input.releaseB ?? "—"} · ${
          input.releaseComparison.available
            ? "supported for this definition"
            : input.releaseComparison.reason
        }`
      : null,
    input.currentWindow
      ? `Current window reported total (${input.fieldLabel ?? "field"}): ${
          input.currentWindow.total ?? "Unknown / no numeric observations"
        } · ${input.currentWindow.totalRuns} started runs · coverage ${input.currentWindow.knownRuns}/${input.currentWindow.finishedRuns} finished`
      : null,
    "",
    "Suggested question: What changed in this workflow's declared results between the current and previous UTC periods?",
    "",
    "Limitations:",
    ...input.limitations.map((item) => `- ${item}`),
    "- Unsupported filters are not broadened — adjust the selection in Studio instead",
  ].filter((line): line is string => Boolean(line))
  return finalizeHandoff(lines, omissions)
}
