import { Array as Arr, Option, pipe } from "effect"
import type { RunEvent } from "../platform/api-types"
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
  Arr.forEach(
    Arr.fromIterable(
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
    omissions: Arr.fromIterable(omissionSet),
  }
}

/** Previewable agent context: factual summary only, not buildRunExport. */
export function buildSafeRunContextHandoff(
  events: readonly RunEvent[],
  input: SafeRunContextInput,
  studioOrigin: string,
): Option.Option<SafeRunContextHandoff> {
  return pipe(
    Arr.head(events),
    Option.map((first) => {
      const selection = summarizeSourceSelection(
        input.filters,
        input.sourceFrom,
        studioOrigin,
      )
      const { state, failure, completed } = terminalEvidence(events)
      const terminal = failure ?? completed
      const omissions = Arr.fromIterable(
        new Set([...defaultOmissions, ...selection.omissions]),
      )
      const lines = [
        "Flowmark investigation context (manual handoff)",
        "Remote MCP read tools are not used on this deployment. Paste this text deliberately and open the evidence link — do not instruct an agent to call unavailable Flowmark tools.",
        "",
        `Project: ${input.projectName} (id: ${input.projectId})`,
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
        `Execution status: ${state === "Running" ? "No final outcome recorded" : state}`,
        `Started (application timestamp): ${first.timestamp}`,
        `Environment: ${first.environment ?? "Not recorded"}`,
        `Release: ${first.release ?? "Not recorded"}`,
        `Correlation ID: ${first.correlationId ?? "Not recorded"}`,
        `Parent run ID: ${first.parentRunId ?? "Not recorded"}`,
        `Failure code: ${failure?.error?.code ?? "Not recorded"}`,
        `Reported outcome label: ${terminal?.outcome ?? "Not recorded"}`,
        `Recorded events: ${events.length}`,
        "",
        "Intentionally omitted from this handoff:",
        ...omissions.map((item) => `- ${item}`),
        "",
        "Application-reported evidence. Business correctness and root cause are not verified by Flowmark.",
      ]
      return {
        preview: lines.join("\n"),
        omissions,
      }
    }),
  )
}
