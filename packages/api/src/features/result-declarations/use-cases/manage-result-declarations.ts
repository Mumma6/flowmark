import { Context, Effect, Layer, Option, Schema } from "effect"
import {
  ResultDeclarationSchema,
  DefinitionImportSchema,
  DefinitionImportApplySchema,
  type DefinitionImportReceipt,
  SearchFieldsSchema,
  type ResultDeclaration,
  type SearchFields,
} from "@flowmarkdev/core"
import {
  InvalidInput,
  PersistenceError,
  Unauthorized,
} from "../../../errors.js"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import { ResultDeclarations } from "../ports/result-declarations.js"
import { importPreview, type ImportPreview } from "../rules/import-preview.js"

export interface ManageResultDeclarationsService {
  readonly applyImport: (
    userId: string,
    projectId: string,
    input: unknown,
  ) => Effect.Effect<
    DefinitionImportReceipt,
    InvalidInput | Unauthorized | PersistenceError
  >
  readonly previewImport: (
    userId: string,
    projectId: string,
    input: unknown,
  ) => Effect.Effect<
    ImportPreview,
    InvalidInput | Unauthorized | PersistenceError
  >
  readonly searchFields: (
    userId: string,
    projectId: string,
    workflow: string,
  ) => Effect.Effect<SearchFields, Unauthorized | PersistenceError>
  readonly setSearchFields: (
    userId: string,
    projectId: string,
    workflow: string,
    input: unknown,
  ) => Effect.Effect<
    SearchFields,
    InvalidInput | Unauthorized | PersistenceError
  >
  readonly list: (
    userId: string,
    projectId: string,
    workflow: string,
  ) => Effect.Effect<
    ReadonlyArray<ResultDeclaration>,
    Unauthorized | PersistenceError
  >
  readonly create: (
    userId: string,
    projectId: string,
    workflow: string,
    input: unknown,
  ) => Effect.Effect<
    ResultDeclaration,
    InvalidInput | Unauthorized | PersistenceError
  >
}

const make = Effect.gen(function* () {
  const authorization = yield* AuthorizeProject
  const declarations = yield* ResultDeclarations
  return {
    applyImport: Effect.fn("ManageResultDeclarations.applyImport")(function* (
      userId: string,
      projectId: string,
      input: unknown,
    ) {
      const authorized = yield* authorization.authorizeOwner(userId, projectId)
      const command = yield* Schema.decodeUnknownEffect(
        DefinitionImportApplySchema,
        { onExcessProperty: "error" },
      )(input).pipe(Effect.mapError((cause) => new InvalidInput({ cause })))
      return yield* declarations.apply(userId, authorized, command)
    }),
    previewImport: Effect.fn("ManageResultDeclarations.previewImport")(
      function* (userId: string, projectId: string, input: unknown) {
        const authorized = yield* authorization.authorizeOwner(
          userId,
          projectId,
        )
        const definition = yield* Schema.decodeUnknownEffect(
          DefinitionImportSchema,
          {
            onExcessProperty: "error",
          },
        )(input).pipe(Effect.mapError((cause) => new InvalidInput({ cause })))
        const searchFields = yield* declarations.searchFields(
          userId,
          authorized,
          definition.workflow,
        )
        const result = yield* Option.match(
          Option.fromUndefinedOr(definition.result),
          {
            onNone: () => Effect.succeed(Option.none<ResultDeclaration>()),
            onSome: ({ revision }) =>
              declarations.find(
                userId,
                authorized,
                definition.workflow,
                revision,
              ),
          },
        )
        return importPreview(authorized, definition, { result, searchFields })
      },
    ),
    searchFields: Effect.fn("ManageResultDeclarations.searchFields")(function* (
      userId: string,
      projectId: string,
      workflow: string,
    ) {
      const authorized = yield* authorization.authorizeUser(userId, projectId)
      return yield* declarations.searchFields(userId, authorized, workflow)
    }),
    setSearchFields: Effect.fn("ManageResultDeclarations.setSearchFields")(
      function* (
        userId: string,
        projectId: string,
        workflow: string,
        input: unknown,
      ) {
        const authorized = yield* authorization.authorizeOwner(
          userId,
          projectId,
        )
        const fields = yield* Schema.decodeUnknownEffect(SearchFieldsSchema)(
          input,
        ).pipe(Effect.mapError((cause) => new InvalidInput({ cause })))
        return yield* declarations.setSearchFields(
          userId,
          authorized,
          workflow,
          fields,
        )
      },
    ),
    list: Effect.fn("ManageResultDeclarations.list")(function* (
      userId: string,
      projectId: string,
      workflow: string,
    ) {
      const authorized = yield* authorization.authorizeUser(userId, projectId)
      return yield* declarations.list(userId, authorized, workflow)
    }),
    create: Effect.fn("ManageResultDeclarations.create")(function* (
      userId: string,
      projectId: string,
      workflow: string,
      input: unknown,
    ) {
      const authorized = yield* authorization.authorizeOwner(userId, projectId)
      const declaration = yield* Schema.decodeUnknownEffect(
        ResultDeclarationSchema,
      )(input).pipe(Effect.mapError((cause) => new InvalidInput({ cause })))
      const created = yield* declarations.create(
        userId,
        authorized,
        workflow,
        declaration,
      )
      if (!created) {
        return yield* new InvalidInput({
          cause:
            "This revision already exists. Create a new revision; historical meaning is immutable.",
        })
      }
      return declaration
    }),
  }
})
export class ManageResultDeclarations extends Context.Service<
  ManageResultDeclarations,
  ManageResultDeclarationsService
>()("@flowmark/api/ManageResultDeclarations") {
  static readonly layer = Layer.effect(ManageResultDeclarations, make)
}
