import { Array, Context, Effect, Layer, Option, Schema } from "effect"
import {
  CaptureRunSchema,
  SharedInvestigationListSchema,
} from "@flowmarkdev/core"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { savedEvidenceAuthorization } from "../../project-access/use-cases/authorize-saved-evidence.js"
import type { ProjectReader } from "../../workflows/models/project-reader.js"
import { CurrentProjectReader } from "../../workflows/models/current-project-reader.js"
import {
  decodeBusinessCursor,
  encodeBusinessCursor,
  queryFingerprint,
} from "../../business-evidence/rules/cursor.js"
import {
  EvidenceCaptures,
  EvidenceCaptureAdmission,
} from "../ports/evidence-captures.js"
import { buildCapture } from "../rules/capture.js"
import {
  readCapture,
  visibleCaptures,
  captureSummary,
} from "./read-captures.js"
const Id = Schema.String.check(Schema.isGUID())
const unavailable = () =>
  new InvalidInput({ cause: "Evidence capture unavailable." })
const decode = <S extends Schema.Top>(schema: S, raw: unknown) =>
  Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(raw).pipe(
    Effect.mapError(
      () =>
        new InvalidInput({
          cause:
            "Invalid capture request. Supply only the source run and a title.",
        }),
    ),
  )
export class ManageEvidenceCaptures extends Context.Service<ManageEvidenceCaptures>()(
  "@flowmark/api/ManageEvidenceCaptures",
  {
    make: Effect.gen(function* () {
      const repository = yield* EvidenceCaptures,
        admission = yield* EvidenceCaptureAdmission,
        authorize = yield* savedEvidenceAuthorization
      const use = <A>(
        reader: ProjectReader,
        projectId: string,
        write: boolean,
        run: Parameters<typeof repository.withAccess<A>>[2],
      ) =>
        Effect.gen(function* () {
          yield* authorize(reader, projectId)
          if (!(yield* admission.local())) {
            return yield* new InvalidInput({
              cause:
                "Captures are available only in verified local development until expiry cleanup is enabled.",
            })
          }
          return yield* repository.withAccess(projectId, write, run)
        }).pipe(Effect.provideService(CurrentProjectReader, reader))
      return {
        capabilities: Effect.fn("EvidenceCaptures.capabilities")(function* (
          reader: ProjectReader,
          requestedProjectId: string,
        ) {
          const projectId = requestedProjectId.toLowerCase()
          yield* authorize(reader, projectId)
          return {
            enabled: yield* admission.local(),
            canCreate: reader._tag === "User",
          }
        }),
        create: Effect.fn("EvidenceCaptures.create")(function* (
          reader: ProjectReader,
          requestedProjectId: string,
          raw: unknown,
        ) {
          const projectId = requestedProjectId.toLowerCase()
          if (reader._tag !== "User") {
            return yield* new Unauthorized({ permission: "write" })
          }
          const input = yield* decode(CaptureRunSchema, raw)
          return yield* use(reader, projectId, true, (access) =>
            buildCapture(projectId, access, input).pipe(
              Effect.flatMap(access.create),
            ),
          )
        }),
        get: Effect.fn("EvidenceCaptures.get")(function* (
          reader: ProjectReader,
          requestedProjectId: string,
          raw: unknown,
        ) {
          const projectId = requestedProjectId.toLowerCase()
          const id = (yield* decode(Id, raw)).toLowerCase()
          return yield* use(reader, projectId, false, (access) =>
            Effect.gen(function* () {
              const records = yield* access.records()
              const row = Option.getOrUndefined(
                Array.findFirst(records, (row) => row.id === id),
              )
              if (!row) {
                return yield* unavailable()
              }
              const read = yield* readCapture(
                projectId,
                access,
                row,
                reader._tag === "User",
              )
              return read ?? (yield* unavailable())
            }),
          )
        }),
        list: Effect.fn("EvidenceCaptures.list")(function* (
          reader: ProjectReader,
          requestedProjectId: string,
          raw: unknown,
        ) {
          const projectId = requestedProjectId.toLowerCase()
          const query = yield* decode(SharedInvestigationListSchema, raw)
          return yield* use(reader, projectId, false, (access) =>
            Effect.gen(function* () {
              const limit = query.limit ?? 25
              const fingerprint = queryFingerprint({
                kind: "captures",
                userId: access.userId,
                role: access.role,
                principal:
                  reader._tag === "DelegatedUser"
                    ? [reader._tag, reader.clientId, reader.authorizationCodeId]
                    : reader._tag,
                limit,
              })
              const after = yield* decodeBusinessCursor(
                query.cursor,
                projectId,
                access.revision,
                fingerprint,
              )
              const rows = yield* visibleCaptures(
                projectId,
                access,
                reader._tag === "User",
              )
              const ids = Array.map(rows, (read) =>
                read.available ? read.capture.id : read.id,
              )
              const start =
                after === undefined
                  ? 0
                  : Option.getOrNull(
                      Option.map(
                        Array.findFirstIndex(ids, (id) => id === after),
                        (index) => index + 1,
                      ),
                    )
              if (start === null) {
                return yield* new InvalidInput({
                  cause: "Capture list changed. Restart from the first page.",
                })
              }
              const page = Array.take(Array.drop(rows, start), limit)
              return {
                items: Array.map(page, captureSummary),
                nextCursor: encodeBusinessCursor(
                  projectId,
                  access.revision,
                  fingerprint,
                  start + page.length < rows.length
                    ? Option.getOrNull(
                        Array.last(Array.take(ids, start + page.length)),
                      )
                    : null,
                ),
              }
            }),
          )
        }),
        delete: Effect.fn("EvidenceCaptures.delete")(function* (
          reader: ProjectReader,
          requestedProjectId: string,
          raw: unknown,
        ) {
          const projectId = requestedProjectId.toLowerCase()
          if (reader._tag !== "User") {
            return yield* new Unauthorized({ permission: "write" })
          }
          const id = (yield* decode(Id, raw)).toLowerCase()
          return yield* use(reader, projectId, true, (access) =>
            access.delete(id),
          )
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
