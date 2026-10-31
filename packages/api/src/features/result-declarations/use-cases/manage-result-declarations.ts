import { Context, Effect, Layer, Schema } from "effect"
import { SearchFieldsSchema, ResultDeclarationSchema } from "@flowmarkdev/core"
import { InvalidInput } from "../../../errors.js"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import { ResultDeclarations } from "../ports/result-declarations.js"

const make = Effect.gen(function* () {
  const authorization = yield* AuthorizeProject
  const declarations = yield* ResultDeclarations
  return {
    searchFields: Effect.fn("ManageResultDeclarations.searchFields")(function* (
      userId: string,
      projectId: string,
      workflow: string,
    ) {
      const authorized = yield* authorization.authorizeUser(userId, projectId)
      return yield* declarations.searchFields(authorized, workflow)
    }),
    setSearchFields: Effect.fn("ManageResultDeclarations.setSearchFields")(
      function* (
        userId: string,
        projectId: string,
        workflow: string,
        input: unknown,
      ) {
        const authorized = yield* authorization.authorizeUser(userId, projectId)
        const fields = yield* Schema.decodeUnknownEffect(SearchFieldsSchema)(
          input,
        ).pipe(Effect.mapError((cause) => new InvalidInput({ cause })))
        return yield* declarations.setSearchFields(authorized, workflow, fields)
      },
    ),
    list: Effect.fn("ManageResultDeclarations.list")(function* (
      userId: string,
      projectId: string,
      workflow: string,
    ) {
      const authorized = yield* authorization.authorizeUser(userId, projectId)
      return yield* declarations.list(authorized, workflow)
    }),
    create: Effect.fn("ManageResultDeclarations.create")(function* (
      userId: string,
      projectId: string,
      workflow: string,
      input: unknown,
    ) {
      const authorized = yield* authorization.authorizeUser(userId, projectId)
      const declaration = yield* Schema.decodeUnknownEffect(
        ResultDeclarationSchema,
      )(input).pipe(Effect.mapError((cause) => new InvalidInput({ cause })))
      const created = yield* declarations.create(
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
  Effect.Success<typeof make>
>()("@flowmark/api/ManageResultDeclarations") {
  static readonly layer = Layer.effect(ManageResultDeclarations, make)
}
