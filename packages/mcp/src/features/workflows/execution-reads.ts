import { createHash } from "node:crypto"
import { requireAgentAccessProjectId } from "@flowmark/auth/agent-access"
import { ExecutionSelectorSchema, GetProjectWorkflowData } from "@flowmark/api"
import { Effect, Match, Schema } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolInputError, McpToolReadError } from "../../errors.js"
import {
  assertHistoryWindow,
  type McpToolFailure,
} from "../../tools/response.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"

const identifier = Schema.String.check(Schema.isUUID())
const cursorSchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(512),
)
const page = {
  version: Schema.Literal(1),
  projectId: identifier,
  cursor: Schema.optional(cursorSchema),
  limit: Schema.optional(
    Schema.Int.check(
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(25),
    ),
  ),
}
export const FindExecutionsSchema = Schema.Struct({
  ...page,
  startedAfter: Schema.String.check(Schema.isMaxLength(40)),
  startedBefore: Schema.String.check(Schema.isMaxLength(40)),
  workflow: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  ),
  selector: Schema.optional(ExecutionSelectorSchema),
})
export const ExplainExecutionSchema = Schema.Struct({
  ...page,
  runId: identifier,
  section: Schema.optional(
    Schema.Literals([
      "observations",
      "events",
      "related",
      "expectations",
      "operations",
    ]),
  ),
})

const scopePrefix = (scope: unknown) =>
  `v1.${createHash("sha256").update(JSON.stringify(scope)).digest("hex")}.`
const cursorFor = (scope: unknown, cursor: string | null) =>
  cursor === null
    ? null
    : scopePrefix(scope) + Buffer.from(cursor).toString("base64url")

const decodeCursor = Effect.fn("ExecutionReads.decodeCursor")(function* (
  scope: unknown,
  cursor: string | undefined,
) {
  if (cursor === undefined) {
    return undefined
  }
  const prefix = scopePrefix(scope)
  const position = cursor.slice(prefix.length)
  if (!cursor.startsWith(prefix) || !/^[A-Za-z0-9_-]+$/.test(position)) {
    return yield* new McpToolInputError({
      reason: "The cursor does not match this request.",
    })
  }
  const decoded = Buffer.from(position, "base64url").toString()
  if (Buffer.from(decoded).toString("base64url") !== position) {
    return yield* new McpToolInputError({ reason: "Invalid execution cursor." })
  }
  return decoded
})

const invalidQuery = () =>
  new McpToolInputError({
    reason:
      "Supply version 1, an authorized project ID and valid execution query fields. Limit is 1–25.",
  })
const persistenceFailure = () =>
  new McpToolReadError({
    reason: "Execution evidence is unavailable.",
  })
const asReader = Effect.fn("ExecutionReads.reader")(function* (
  identity: FlowmarkMcpAuthInfo,
  projectId: string,
) {
  const family = yield* resolveMcpGrantFamily(identity)
  return mcpDelegatedReader(identity, family.familyId, projectId)
})

export const findExecutionsForMcp: (
  identity: FlowmarkMcpAuthInfo,
  raw: unknown,
) => Effect.Effect<
  Record<string, unknown>,
  McpToolFailure,
  GetProjectWorkflowData | import("@flowmark/api").AuthorizeAgentRead
> = Effect.fn("ExecutionReads.find")(function* (
  identity: FlowmarkMcpAuthInfo,
  raw: unknown,
) {
  const { cursor, limit, version, ...scope } =
    yield* Schema.decodeUnknownEffect(FindExecutionsSchema, {
      onExcessProperty: "error",
    })(raw).pipe(Effect.mapError(invalidQuery))
  yield* requireAgentAccessProjectId("find_executions", scope.projectId)
  yield* assertHistoryWindow(scope.startedAfter, scope.startedBefore)
  const position = yield* decodeCursor(scope, cursor)
  if (position !== undefined) {
    const [timestamp, runId, extra] = position.split("|")
    if (
      !timestamp ||
      !Number.isFinite(Date.parse(timestamp)) ||
      !Schema.is(identifier)(runId) ||
      extra !== undefined
    ) {
      return yield* new McpToolInputError({
        reason: "Invalid execution cursor.",
      })
    }
  }
  const reader = yield* asReader(identity, scope.projectId)
  const queries = yield* GetProjectWorkflowData
  const result = yield* queries
    .listRuns(reader, {
      namespace: "application",
      workflow: scope.workflow,
      startedAfter: scope.startedAfter,
      startedBefore: scope.startedBefore,
      executionSelector: scope.selector ?? {},
      cursor: position,
      limit: limit ?? 10,
    })
    .pipe(
      Effect.mapError((error) =>
        error._tag === "PersistenceError" ? persistenceFailure() : error,
      ),
    )
  return {
    tool: "find_executions",
    version,
    projectId: scope.projectId,
    total: result.total,
    executions: result.runs.map(
      ({ id, workflow, startedAt, status, outcome }) => ({
        runId: id,
        workflow,
        startedAt,
        status,
        outcome,
      }),
    ),
    nextCursor: cursorFor(scope, result.nextCursor),
  }
})

export const explainExecutionForMcp: (
  identity: FlowmarkMcpAuthInfo,
  raw: unknown,
) => Effect.Effect<
  Record<string, unknown>,
  McpToolFailure,
  GetProjectWorkflowData | import("@flowmark/api").AuthorizeAgentRead
> = Effect.fn("ExecutionReads.explain")(function* (
  identity: FlowmarkMcpAuthInfo,
  raw: unknown,
) {
  const input = yield* Schema.decodeUnknownEffect(ExplainExecutionSchema, {
    onExcessProperty: "error",
  })(raw).pipe(Effect.mapError(invalidQuery))
  yield* requireAgentAccessProjectId("explain_execution", input.projectId)
  const scope = {
    projectId: input.projectId,
    runId: input.runId,
    section: input.section ?? "observations",
  }
  const cursor = yield* decodeCursor(scope, input.cursor)
  const reader = yield* asReader(identity, scope.projectId)
  const queries = yield* GetProjectWorkflowData
  const query = { runId: scope.runId, cursor, limit: input.limit ?? 10 }

  const summary = yield* queries
    .runInvestigationSummary(reader, scope.runId)
    .pipe(
      Effect.catchTag("PersistenceError", () =>
        Effect.fail(persistenceFailure()),
      ),
    )
  const evidence = yield* Match.value(scope.section)
    .pipe(
      Match.when("observations", () =>
        queries.runEventPage(reader, { ...query, observationsOnly: true }),
      ),
      Match.when("events", () => queries.runEventPage(reader, query)),
      Match.when("expectations", () => queries.expectationsPage(reader, query)),
      Match.when("related", () => queries.relatedRunsPage(reader, query)),
      Match.when("operations", () => queries.operationsPage(reader, query)),
      Match.exhaustive,
    )
    .pipe(
      Effect.catchTag("PersistenceError", () =>
        Effect.fail(persistenceFailure()),
      ),
    )

  const { nextCursor, ...page } = evidence
  return {
    tool: "explain_execution",
    version: input.version,
    ...scope,
    summary,
    evidence: page,
    nextCursor: cursorFor(scope, nextCursor),
    interpretation:
      "Run status, application-reported outcomes, and later expectation settlements are separate evidence.",
  }
})
