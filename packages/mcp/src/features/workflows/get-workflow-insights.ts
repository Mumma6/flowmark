import {
  businessToolEvidence,
  type McpBusinessResult,
} from "./business-evidence.js"
import type { AuthorizeAgentRead } from "@flowmark/api"
import { GetBusinessEvidence, GetProjectWorkflowData } from "@flowmark/api"
import { Effect, Match, Option } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolReadError } from "../../errors.js"
import {
  decodeWorkflowInsightsInput,
  type WorkflowInsightsInput,
} from "../../tools/schemas.js"
import type { McpToolFailure } from "../../tools/response.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"
import type { McpWorkflowInsightsResult } from "./types.js"

const readError = (reason: string) =>
  Effect.fail(new McpToolReadError({ reason }))

const windowFilter = (
  workflow: string | null,
  startedAfter: string,
  startedBefore: string,
) => ({
  tool: "find_runs" as const,
  workflow,
  startedAfter,
  startedBefore,
})

const evidenceFilters = (input: WorkflowInsightsInput) => ({
  current: windowFilter(
    input.query.workflow ?? null,
    input.query.currentStartedAfter,
    input.query.currentStartedBefore,
  ),
  previous: windowFilter(
    input.query.workflow ?? null,
    input.query.previousStartedAfter,
    input.query.previousStartedBefore,
  ),
  declaredResult: Match.value(input).pipe(
    Match.when({ mode: "technical" }, () => null),
    Match.when({ mode: "business" }, ({ query }) => query),
    Match.exhaustive,
  ),
})

export const getWorkflowInsightsForMcp: (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
) => Effect.Effect<
  McpWorkflowInsightsResult | McpBusinessResult,
  McpToolFailure,
  GetProjectWorkflowData | GetBusinessEvidence | AuthorizeAgentRead
> = Effect.fn("McpWorkflowInsights.execute")(function* (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
) {
  const input = yield* decodeWorkflowInsightsInput(rawInput)
  const family = yield* resolveMcpGrantFamily(identity)
  const reader = mcpDelegatedReader(identity, family.familyId, input.projectId)
  const business = yield* businessToolEvidence(
    reader,
    "get_workflow_insights",
    () =>
      input.mode === "business"
        ? { kind: "insights", query: input.query }
        : { kind: "withheld-technical" },
  )
  if (Option.isSome(business)) {
    return business.value
  }
  const queries = yield* GetProjectWorkflowData
  const report = yield* Match.value(input).pipe(
    Match.when({ mode: "technical" }, ({ query }) =>
      queries.periodReport(reader, query).pipe(
        Effect.catchTags({
          PersistenceError: () =>
            readError("Technical period report could not be read."),
        }),
      ),
    ),
    Match.when({ mode: "business" }, ({ query }) =>
      queries.businessInsights(reader, query).pipe(
        Effect.catchTags({
          PersistenceError: () =>
            readError("Business insights could not be read."),
        }),
      ),
    ),
    Match.exhaustive,
  )
  return {
    tool: "get_workflow_insights",
    projectId: input.projectId,
    mode: input.mode,
    selection: input.query,
    report,
    evidenceFilters: evidenceFilters(input),
    distinctions: {
      baseline:
        "An empty previous window is an absent baseline. Counts stay the recorded population and are not reconstructed history.",
      coverage:
        "missingResult, missingField, incompatibleRevision, wrongType, and failureGroupsTruncated are coverage. They are not imputed evidence.",
      environment:
        "This aggregate has no environment filter. find_runs can page an environment cohort; that page is not this population.",
      causality:
        "Differences describe recorded evidence. They do not establish a cause.",
    },
  } satisfies McpWorkflowInsightsResult
})
