import { CurrentProjectReader } from "../../workflows/models/current-project-reader.js"
import {
  PeriodReadInputSchema,
  PeriodReadResponseSchema,
  periodReadEvidencePath,
  type PeriodReadResponse,
} from "@flowmarkdev/core"
import { Array, Clock, Context, Effect, Layer, Schema } from "effect"
import { WorkflowRepository } from "../../workflows/ports/workflow-repository.js"
import { PublicReadFailure } from "../errors.js"
import { AuthorizePublicRead } from "./authorize-public-read.js"

export class ReadPublicPeriod extends Context.Service<
  ReadPublicPeriod,
  {
    readonly read: (
      header: string | null,
      raw: unknown,
    ) => Effect.Effect<PeriodReadResponse, PublicReadFailure>
  }
>()("@flowmark/api/ReadPublicPeriod") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const authorization = yield* AuthorizePublicRead
      const repository = yield* WorkflowRepository
      return ReadPublicPeriod.of({
        read: Effect.fn("ReadPublicPeriod.read")(function* (header, raw) {
          const projectId = yield* authorization.authorize(header)
          if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            return yield* new PublicReadFailure({ code: "INVALID_REQUEST" })
          }
          if (!("version" in raw) || raw.version !== 1) {
            return yield* new PublicReadFailure({ code: "UNSUPPORTED_VERSION" })
          }
          const fields = [
            "version",
            "kind",
            "projectId",
            "workflow",
            "currentStartedAfter",
            "currentStartedBefore",
            "previousStartedAfter",
            "previousStartedBefore",
          ]
          if (
            !("kind" in raw) ||
            raw.kind !== "period" ||
            Object.keys(raw).some((key) => !Array.contains(fields, key))
          ) {
            return yield* new PublicReadFailure({
              code: "UNSUPPORTED_SELECTION",
            })
          }
          const input = yield* Schema.decodeUnknownEffect(
            PeriodReadInputSchema,
          )(raw, { onExcessProperty: "error" }).pipe(
            Effect.mapError(
              () => new PublicReadFailure({ code: "INVALID_REQUEST" }),
            ),
          )
          if (input.projectId.toLowerCase() !== projectId.toLowerCase()) {
            return yield* new PublicReadFailure({ code: "PROJECT_FORBIDDEN" })
          }
          const selection = { ...input, projectId }
          const report = yield* repository
            .periodRead(projectId, selection)
            .pipe(
              Effect.provideService(CurrentProjectReader, {
                _tag: "Key",
                header,
              }),
            )
          return yield* Schema.decodeUnknownEffect(PeriodReadResponseSchema)({
            version: 1,
            mode: "technical",
            selection,
            observedAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
            capabilities: ["technical_period_windows"],
            report,
            coverage: {
              currentOpenRuns:
                report.current.totalRuns - report.current.finishedRuns,
              previousOpenRuns:
                report.previous.totalRuns - report.previous.finishedRuns,
              previousWindowHasRuns: report.previous.totalRuns > 0,
              durationObservationCounts: null,
            },
            continuation: null,
            evidence: { periodPath: periodReadEvidencePath(selection) },
            omissions: [
              "daily",
              "operations",
              "failure_groups",
              "workflow_catalog",
              "duration_observation_counts",
            ],
          }).pipe(
            Effect.mapError(
              () => new PublicReadFailure({ code: "READ_UNAVAILABLE" }),
            ),
          )
        }),
      })
    }),
  ).pipe(Layer.provide(AuthorizePublicRead.layer))
}
