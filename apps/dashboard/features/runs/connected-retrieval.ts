import {
  BusinessInsightsQuerySchema,
  periodCohortToolInput,
  runSelectionToolInput,
} from "@flowmarkdev/core"
import { Result, Schema } from "effect"
import { handoffRunSelection } from "./investigation-selection"

export type RetrievalCall = {
  readonly tool: "get_run" | "find_runs" | "get_workflow_insights"
  readonly input: Readonly<Record<string, unknown>>
}

/** A copied call is not a grant. An empty list means do not invent a wider query. */
export const connectedRunCalls = (
  projectId: string,
  runId: string,
  rawSelection: string | null = null,
): readonly RetrievalCall[] =>
  Result.match(handoffRunSelection(projectId, runId, rawSelection), {
    onFailure: () => [],
    onSuccess: (selection) =>
      Result.match(runSelectionToolInput(selection), {
        onFailure: () => [],
        onSuccess: (input) => [{ tool: "get_run", input }],
      }),
  })

export const connectedFailureCalls = (input: {
  readonly projectId: string
  readonly workflow: string
  readonly code: string
  readonly currentStartedAfter: string
  readonly currentStartedBefore: string
  readonly previousStartedAfter: string
  readonly previousStartedBefore: string
}): readonly RetrievalCall[] => {
  return Result.match(
    periodCohortToolInput({
      version: 1,
      kind: "period",
      projectId: input.projectId,
      workflow: input.workflow,
      currentStartedAfter: input.currentStartedAfter,
      currentStartedBefore: input.currentStartedBefore,
      previousStartedAfter: input.previousStartedAfter,
      previousStartedBefore: input.previousStartedBefore,
    }),
    {
      onFailure: () => [],
      onSuccess: (toolInput) => [
        { tool: "get_workflow_insights", input: toolInput },
        {
          tool: "find_runs",
          input: {
            projectId: input.projectId,
            startedAfter: input.currentStartedAfter,
            startedBefore: input.currentStartedBefore,
            workflow: input.workflow,
            status: "Failed",
            ...(input.code ? { failCode: input.code } : {}),
          },
        },
      ],
    },
  )
}

const businessToolInput = Schema.Struct({
  projectId: Schema.String,
  mode: Schema.Literal("business"),
  query: BusinessInsightsQuerySchema,
})

export const connectedInsightCalls = (input: {
  readonly projectId: string
  readonly validDates: boolean
  readonly query: {
    readonly workflow: string
    readonly revision: string
    readonly path: readonly string[]
    readonly currentStartedAfter: string
    readonly currentStartedBefore: string
    readonly previousStartedAfter: string
    readonly previousStartedBefore: string
    readonly businessKey?: string
    readonly businessValue?: string
    readonly numerator?: readonly string[]
    readonly denominator?: readonly string[]
    readonly releaseA?: string
    readonly releaseB?: string
  }
}): readonly RetrievalCall[] => {
  if (!input.validDates) {
    return []
  }
  const dimension =
    input.query.businessKey && input.query.businessValue
      ? {
          businessKey: input.query.businessKey,
          businessValue: input.query.businessValue,
        }
      : input.query.businessKey || input.query.businessValue
        ? null
        : {}
  if (dimension === null) {
    return []
  }
  const ratio =
    input.query.numerator && input.query.denominator
      ? {
          numerator: input.query.numerator,
          denominator: input.query.denominator,
        }
      : input.query.numerator || input.query.denominator
        ? null
        : {}
  if (ratio === null) {
    return []
  }
  const releases =
    input.query.releaseA &&
    input.query.releaseB &&
    input.query.releaseA !== input.query.releaseB
      ? { releaseA: input.query.releaseA, releaseB: input.query.releaseB }
      : input.query.releaseA || input.query.releaseB
        ? null
        : {}
  if (releases === null) {
    return []
  }
  return Result.match(
    Schema.decodeUnknownResult(businessToolInput)({
      projectId: input.projectId,
      mode: "business",
      query: {
        workflow: input.query.workflow,
        revision: input.query.revision,
        path: input.query.path,
        currentStartedAfter: input.query.currentStartedAfter,
        currentStartedBefore: input.query.currentStartedBefore,
        previousStartedAfter: input.query.previousStartedAfter,
        previousStartedBefore: input.query.previousStartedBefore,
        ...dimension,
        ...ratio,
        ...releases,
      },
    }),
    {
      onFailure: () => [],
      onSuccess: ({ projectId, query }) => [
        {
          tool: "get_workflow_insights",
          input: { projectId, mode: "business", ...query },
        },
      ],
    },
  )
}

export const retrievalInstructionLines = (
  calls: readonly RetrievalCall[],
): readonly string[] =>
  calls.length === 0
    ? [
        "Supported tool query: none. Do not replace this selection with a broader project, window, revision, or filter.",
        "",
      ]
    : [
        "Supported tool queries (same population as Studio; copying does not authorize the agent):",
        ...calls.flatMap((call) => [
          `Tool: ${call.tool}`,
          JSON.stringify(call.input),
          "",
        ]),
      ]
