import { requireAgentAccessProjectId } from "@flowmark/auth/agent-access"
import { BehaviorComparisonSchema, GetProjectWorkflowData } from "@flowmark/api"
import { Effect, Schema } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolInputError, McpToolReadError } from "../../errors.js"
import { assertHistoryWindow } from "../../tools/response.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"

export const CompareBehaviorSchema = Schema.Struct({
  version: Schema.Literal(1),
  projectId: Schema.String.check(Schema.isUUID()),
  ...BehaviorComparisonSchema.fields,
})

export const compareBehaviorForMcp = Effect.fn("CompareBehavior.execute")(
  function* (identity: FlowmarkMcpAuthInfo, raw: unknown) {
    const { version, projectId, ...query } = yield* Schema.decodeUnknownEffect(
      CompareBehaviorSchema,
      { onExcessProperty: "error" },
    )(raw).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason:
              "Supply two deployment windows for one workflow and behavior, with distinct normal and fallback step names.",
          }),
      ),
    )
    yield* requireAgentAccessProjectId("compare_behavior", projectId)
    yield* assertHistoryWindow(
      query.before.startedAfter,
      query.before.startedBefore,
    )
    yield* assertHistoryWindow(
      query.after.startedAfter,
      query.after.startedBefore,
    )
    if (
      Date.parse(query.before.startedAfter) >=
        Date.parse(query.before.startedBefore) ||
      Date.parse(query.before.startedBefore) >
        Date.parse(query.after.startedAfter) ||
      Date.parse(query.after.startedAfter) >=
        Date.parse(query.after.startedBefore) ||
      query.before.deploymentId === query.after.deploymentId ||
      query.fallbackStep === query.normalStep
    ) {
      return yield* new McpToolInputError({
        reason:
          "Use distinct deployments and step names, with non-empty, ordered and non-overlapping windows.",
      })
    }

    const family = yield* resolveMcpGrantFamily(identity)
    const queries = yield* GetProjectWorkflowData
    const comparison = yield* queries
      .compareBehavior(
        mcpDelegatedReader(identity, family.familyId, projectId),
        query,
      )
      .pipe(
        Effect.catchTag("PersistenceError", () =>
          Effect.fail(
            new McpToolReadError({
              reason: "Behavior comparison could not be read.",
            }),
          ),
        ),
      )
    return {
      tool: "compare_behavior",
      version,
      projectId,
      selection: query,
      unit: "recorded-execution",
      interpretation:
        "Each category counts a run once. Categories can overlap. Counts describe retained evidence; sampling policy is caller-declared and the traffic denominator is unknown.",
      ...comparison,
    }
  },
)
