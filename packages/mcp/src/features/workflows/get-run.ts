import { GetProjectWorkflowData } from "@flowmark/api"
import { Effect, Match } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolReadError } from "../../errors.js"
import { decodeGetRunInput } from "../../tools/schemas.js"
import type { McpToolFailure } from "../../tools/response.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"
import type { McpGetRunResult, McpGetRunSection } from "./types.js"

const availableSections = [
  "events",
  "related",
  "expectations",
  "operations",
] as const satisfies readonly McpGetRunSection[]

const readError = (reason: string) =>
  Effect.fail(new McpToolReadError({ reason }))

export const getRunForMcp: (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
) => Effect.Effect<McpGetRunResult, McpToolFailure, GetProjectWorkflowData> =
  Effect.fn("McpGetRun.execute")(function* (
    identity: FlowmarkMcpAuthInfo,
    rawInput: unknown,
  ) {
    const input = yield* decodeGetRunInput(rawInput)
    const family = yield* resolveMcpGrantFamily(identity)
    const reader = mcpDelegatedReader(
      identity,
      family.familyId,
      input.projectId,
    )
    const queries = yield* GetProjectWorkflowData
    const summary = yield* queries
      .runInvestigationSummary(reader, input.runId)
      .pipe(
        Effect.catchTags({
          PersistenceError: () => readError("Run summary could not be read."),
        }),
      )
    const section = input.section ?? "events"
    const query = {
      runId: input.runId,
      cursor: input.cursor,
      limit: input.limit,
    }
    const page = yield* Match.value(section).pipe(
      Match.when("events", () =>
        queries.runEventPage(reader, query).pipe(
          Effect.catchTags({
            PersistenceError: () => readError("Run events could not be read."),
          }),
        ),
      ),
      Match.when("related", () =>
        queries.relatedRunsPage(reader, query).pipe(
          Effect.catchTags({
            PersistenceError: () =>
              readError("Related runs could not be read."),
          }),
        ),
      ),
      Match.when("expectations", () =>
        queries.expectationsPage(reader, query).pipe(
          Effect.catchTags({
            PersistenceError: () =>
              readError("Run expectations could not be read."),
          }),
        ),
      ),
      Match.when("operations", () =>
        queries.operationsPage(reader, query).pipe(
          Effect.catchTags({
            PersistenceError: () =>
              readError("Run operations could not be read."),
          }),
        ),
      ),
      Match.exhaustive,
    )
    return {
      tool: "get_run",
      projectId: input.projectId,
      runId: input.runId,
      summary,
      section,
      page,
      nextCursor: page.nextCursor,
      availableSections,
      distinctions: {
        runStatus:
          "Reported run status. An operation error is not a terminal run failure.",
        durationMs:
          "Recorded run duration from telemetry. Flowmark does not infer wall-clock time.",
        operationStatus:
          "Operation pages report completed, failed, open, or absent separately from the run status.",
      },
    } satisfies McpGetRunResult
  })
