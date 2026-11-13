import { visibleSharedInvestigations } from "./visible-shared-investigations.js"
import { Array, Context, Effect, Layer, Option, Schema } from "effect"
import {
  ShareInvestigationSchema,
  SharedInvestigationListSchema,
} from "@flowmarkdev/core"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { savedEvidenceAuthorization } from "../../project-access/use-cases/authorize-saved-evidence.js"
import type { ProjectReader } from "../../workflows/models/project-reader.js"
import { CurrentProjectReader } from "../../workflows/models/current-project-reader.js"
import {
  decodePublication,
  publicationMeaning,
} from "../../business-evidence/rules/publication.js"
import {
  decodeBusinessCursor,
  encodeBusinessCursor,
  queryFingerprint,
} from "../../business-evidence/rules/cursor.js"
import { SharedInvestigations } from "../ports/shared-investigations.js"
import { validateSharedSelection } from "../rules/selection.js"
const Id = Schema.String.check(Schema.isGUID())
const unavailable = () =>
  new InvalidInput({ cause: "This shared investigation is unavailable." })
const decode = <S extends Schema.Top>(schema: S, raw: unknown) =>
  Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(raw).pipe(
    Effect.mapError(
      () =>
        new InvalidInput({
          cause:
            "Invalid shared investigation. Use a supported question without credentials or extra fields.",
        }),
    ),
  )
export class ManageSharedInvestigations extends Context.Service<ManageSharedInvestigations>()(
  "@flowmark/api/ManageSharedInvestigations",
  {
    make: Effect.gen(function* () {
      const repository = yield* SharedInvestigations
      const authorize = yield* savedEvidenceAuthorization
      const use = <A>(
        reader: ProjectReader,
        projectId: string,
        write: boolean,
        run: Parameters<typeof repository.withAccess<A>>[2],
      ) =>
        authorize(reader, projectId).pipe(
          Effect.flatMap(() => repository.withAccess(projectId, write, run)),
          Effect.provideService(CurrentProjectReader, reader),
        )
      return {
        create: Effect.fn("SharedInvestigations.create")(function* (
          reader: ProjectReader,
          projectId: string,
          raw: unknown,
        ) {
          if (reader._tag !== "User") {
            return yield* new Unauthorized({ permission: "write" })
          }
          const input = yield* decode(ShareInvestigationSchema, raw)
          return yield* use(reader, projectId, true, (access) =>
            Effect.gen(function* () {
              const meaning =
                input.selection.depth === "business"
                  ? publicationMeaning(
                      yield* decodePublication(access.publication),
                      yield* access.choices(),
                    )
                  : { results: [], references: [] }
              yield* validateSharedSelection(
                projectId,
                access.role,
                input.selection,
                meaning,
              )
              return { id: yield* access.create(input) }
            }),
          )
        }),
        get: Effect.fn("SharedInvestigations.get")(function* (
          reader: ProjectReader,
          projectId: string,
          raw: unknown,
        ) {
          const id = yield* decode(Id, raw)
          return yield* use(reader, projectId, false, (access) =>
            visibleSharedInvestigations(
              projectId,
              access,
              reader._tag === "User",
            ).pipe(
              Effect.flatMap(({ rows }) =>
                Array.findFirst(rows, (row) => row.id === id).pipe(
                  Option.match({
                    onSome: Effect.succeed,
                    onNone: () => Effect.fail(unavailable()),
                  }),
                ),
              ),
            ),
          )
        }),
        list: Effect.fn("SharedInvestigations.list")(function* (
          reader: ProjectReader,
          projectId: string,
          raw: unknown,
        ) {
          const query = yield* decode(SharedInvestigationListSchema, raw)
          return yield* use(reader, projectId, false, (access) =>
            Effect.gen(function* () {
              const limit = query.limit ?? 25
              const fingerprint = queryFingerprint({
                kind: "shared-investigations",
                principal:
                  reader._tag === "DelegatedUser"
                    ? [reader._tag, reader.clientId, reader.authorizationCodeId]
                    : reader._tag,
                userId: access.userId,
                role: access.role,
                limit,
              })
              const after = yield* decodeBusinessCursor(
                query.cursor,
                projectId,
                access.revision,
                fingerprint,
              )
              const { summaries: rows } = yield* visibleSharedInvestigations(
                projectId,
                access,
                reader._tag === "User",
              )
              const start =
                after === undefined
                  ? 0
                  : Array.findFirstIndex(rows, (row) => row.id === after).pipe(
                      Option.map((index) => index + 1),
                      Option.getOrNull,
                    )
              if (start === null) {
                return yield* new InvalidInput({
                  cause: "Shared list changed. Restart from the first page.",
                })
              }
              const page = Array.take(Array.drop(rows, start), limit)
              return {
                items: page,
                nextCursor: encodeBusinessCursor(
                  projectId,
                  access.revision,
                  fingerprint,
                  start + page.length < rows.length
                    ? Array.last(page).pipe(
                        Option.map((row) => row.id),
                        Option.getOrNull,
                      )
                    : null,
                ),
              }
            }),
          )
        }),
        revoke: Effect.fn("SharedInvestigations.revoke")(function* (
          reader: ProjectReader,
          projectId: string,
          raw: unknown,
        ) {
          if (reader._tag !== "User") {
            return yield* new Unauthorized({ permission: "write" })
          }
          const id = yield* decode(Id, raw)
          return yield* use(reader, projectId, true, (access) =>
            access.revoke(id),
          )
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
