import { Array, Context, Effect, Layer, Option, Result, Schema } from "effect"
import {
  SaveInvestigationSchema,
  SavedInvestigationListSchema,
  SavedSelectionSchema,
  type SavedInvestigation,
  type SavedInvestigationSummary,
} from "@flowmarkdev/core"
import { InvalidInput } from "../../../errors.js"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import {
  Investigations,
  type StoredInvestigation,
} from "../ports/investigations.js"

const decodeSelection = Schema.decodeUnknownResult(SavedSelectionSchema, {
  onExcessProperty: "error",
})
const projectStored = (
  projectId: string,
  row: StoredInvestigation,
): SavedInvestigation => {
  const selection = decodeSelection(row.selection).pipe(
    Result.filterOrFail(
      (selection) =>
        selection.projectId.toLowerCase() === projectId.toLowerCase(),
      () => "Project mismatch",
    ),
    Result.getOrNull,
  )
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    selection,
    kind: selection?.kind ?? null,
    supported: selection !== null,
  }
}
const summary = (row: SavedInvestigation): SavedInvestigationSummary => ({
  id: row.id,
  title: row.title,
  createdAt: row.createdAt,
  kind: row.kind,
  supported: row.supported,
})
const decode = <S extends Schema.Top>(schema: S, input: unknown) =>
  Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(
      () =>
        new InvalidInput({
          cause:
            "Unsupported or invalid saved investigation. Use a supported version 1 selection; credentials and extra fields are not accepted.",
        }),
    ),
  )
const Id = Schema.String.check(Schema.isGUID())

export class ManageInvestigations extends Context.Service<ManageInvestigations>()(
  "@flowmark/api/ManageInvestigations",
  {
    make: Effect.gen(function* () {
      const auth = yield* AuthorizeProject
      const repository = yield* Investigations
      return {
        save: Effect.fn("ManageInvestigations.save")(function* (
          userId: string,
          projectId: string,
          input: unknown,
        ) {
          const authorized = yield* auth.authorizeUser(userId, projectId)
          const command = yield* decode(SaveInvestigationSchema, input)
          if (
            command.selection.projectId.toLowerCase() !==
            authorized.toLowerCase()
          ) {
            return yield* new InvalidInput({
              cause: "The saved selection belongs to another project.",
            })
          }
          return projectStored(
            authorized,
            yield* repository.save(userId, authorized, command),
          )
        }),
        list: Effect.fn("ManageInvestigations.list")(function* (
          userId: string,
          projectId: string,
          input: unknown,
        ) {
          const authorized = yield* auth.authorizeUser(userId, projectId)
          const query = yield* decode(SavedInvestigationListSchema, input)
          const page = yield* repository.list(userId, authorized, query)
          return {
            ...page,
            items: Array.map(page.items, (row) =>
              summary(projectStored(authorized, row)),
            ),
          }
        }),
        get: Effect.fn("ManageInvestigations.get")(function* (
          userId: string,
          projectId: string,
          input: unknown,
        ) {
          const authorized = yield* auth.authorizeUser(userId, projectId)
          const id = yield* decode(Id, input)
          return (yield* repository.get(userId, authorized, id)).pipe(
            Option.map((row) => projectStored(authorized, row)),
            Option.getOrNull,
          )
        }),
        delete: Effect.fn("ManageInvestigations.delete")(function* (
          userId: string,
          projectId: string,
          input: unknown,
        ) {
          const authorized = yield* auth.authorizeUser(userId, projectId)
          const id = yield* decode(Id, input)
          return yield* repository.delete(userId, authorized, id)
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
