import { CurrentProjectReader } from "../../workflows/models/current-project-reader.js"
import {
  RunReadInputSchema,
  RunReadResponseSchema,
  runReadEvidencePath,
  type RunReadResponse,
} from "@flowmarkdev/core"
import { Array, Clock, Context, Effect, Layer, Schema } from "effect"
import { AuthorizePublicRead } from "./authorize-public-read.js"
import { WorkflowRepository } from "../../workflows/ports/workflow-repository.js"
import { PublicReadFailure } from "../errors.js"

export class ReadPublicRun extends Context.Service<
  ReadPublicRun,
  {
    readonly read: (
      header: string | null,
      raw: unknown,
    ) => Effect.Effect<RunReadResponse, PublicReadFailure>
  }
>()("@flowmark/api/ReadPublicRun") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const authorization = yield* AuthorizePublicRead
      const repository = yield* WorkflowRepository
      return ReadPublicRun.of({
        read: Effect.fn("ReadPublicRun.read")(function* (header, raw) {
          const projectId = yield* authorization.authorize(header)
          if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            return yield* new PublicReadFailure({ code: "INVALID_REQUEST" })
          }
          if (!("version" in raw) || raw.version !== 1) {
            return yield* new PublicReadFailure({ code: "UNSUPPORTED_VERSION" })
          }
          if (
            !("kind" in raw) ||
            raw.kind !== "run" ||
            !("section" in raw) ||
            raw.section !== "events" ||
            Object.keys(raw).some(
              (key) =>
                !Array.contains(Object.keys(RunReadInputSchema.fields), key),
            )
          ) {
            return yield* new PublicReadFailure({
              code: "UNSUPPORTED_SELECTION",
            })
          }
          const input = yield* Schema.decodeUnknownEffect(RunReadInputSchema)(
            raw,
            { onExcessProperty: "error" },
          ).pipe(
            Effect.mapError(
              () => new PublicReadFailure({ code: "INVALID_REQUEST" }),
            ),
          )
          if (input.projectId.toLowerCase() !== projectId.toLowerCase()) {
            return yield* new PublicReadFailure({ code: "PROJECT_FORBIDDEN" })
          }
          const selection = {
            ...input,
            projectId,
            runId: input.runId.toLowerCase(),
            limit: input.limit ?? 50,
          }
          const evidence = yield* repository.runRead(projectId, selection).pipe(
            Effect.provideService(CurrentProjectReader, {
              _tag: "Key",
              header,
            }),
          )
          return yield* Schema.decodeUnknownEffect(RunReadResponseSchema)({
            version: 1,
            selection,
            observedAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
            ...evidence,
            evidence: { runPath: runReadEvidencePath(selection) },
            omissions: ["event_payloads", "business_results"],
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
