import {
  RunReadInputSchema,
  RunReadResponseSchema,
  runReadEvidencePath,
  type RunReadResponse,
} from "@flowmarkdev/core"
import { DEMO_READ_KEY } from "@flowmark/db/demo"
import { Array, Clock, Context, Effect, Layer, Schema } from "effect"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import { WorkflowRepository } from "../../workflows/ports/workflow-repository.js"
import { PublicReadAdmission } from "../ports/public-read-admission.js"
import { PublicReadFailure, publicStorageFailure } from "../errors.js"

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
      const authorization = yield* AuthorizeProject
      const repository = yield* WorkflowRepository
      const admission = yield* PublicReadAdmission
      return ReadPublicRun.of({
        read: Effect.fn("ReadPublicRun.read")(function* (header, raw) {
          yield* admission.consume("service", 3000)
          if (
            !header?.startsWith("Bearer fm_read_") ||
            header.length > 256 ||
            header === `Bearer ${DEMO_READ_KEY}`
          ) {
            return yield* new PublicReadFailure({ code: "UNAUTHORIZED" })
          }
          const projectId = yield* authorization.authorize(header, "read").pipe(
            Effect.catchTags({
              Unauthorized: () =>
                Effect.fail(new PublicReadFailure({ code: "UNAUTHORIZED" })),
              PersistenceError: (error) =>
                Effect.fail(publicStorageFailure(error)),
            }),
          )
          // Only authenticated keys allocate their own admission counter; storage
          // hashes the whole namespace, including this secret, before persisting it.
          yield* admission.consume(`key:${header.slice(7)}`, 120)
          yield* admission.consume(`project:${projectId}`, 600)
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
          const evidence = yield* repository.runRead(projectId, selection)
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
  )
}
