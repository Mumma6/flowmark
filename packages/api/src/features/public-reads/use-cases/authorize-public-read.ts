import { DEMO_READ_KEY } from "@flowmark/db/demo"
import { Context, Effect, Layer } from "effect"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import { PublicReadAdmission } from "../ports/public-read-admission.js"
import { PublicReadFailure, publicStorageFailure } from "../errors.js"

/** Shared admission and exact stored read permission; selections grant no scope. */
export class AuthorizePublicRead extends Context.Service<
  AuthorizePublicRead,
  {
    readonly authorize: (
      header: string | null,
    ) => Effect.Effect<string, PublicReadFailure>
  }
>()("@flowmark/api/AuthorizePublicRead") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const authorization = yield* AuthorizeProject
      const admission = yield* PublicReadAdmission
      return AuthorizePublicRead.of({
        authorize: Effect.fn("AuthorizePublicRead.authorize")(
          function* (header) {
            yield* admission.consume("service", 3000)
            if (
              !header?.startsWith("Bearer fm_read_") ||
              header.length > 256 ||
              header === `Bearer ${DEMO_READ_KEY}`
            ) {
              return yield* new PublicReadFailure({ code: "UNAUTHORIZED" })
            }
            const projectId = yield* authorization
              .authorize(header, "read")
              .pipe(
                Effect.catchTags({
                  Unauthorized: () =>
                    Effect.fail(
                      new PublicReadFailure({ code: "UNAUTHORIZED" }),
                    ),
                  PersistenceError: (error) =>
                    Effect.fail(publicStorageFailure(error)),
                }),
              )
            // Only authenticated keys allocate their own admission counter; storage
            // hashes the whole namespace, including this secret, before persisting it.
            yield* admission.consume(`key:${header.slice(7)}`, 120)
            yield* admission.consume(`project:${projectId}`, 600)
            return projectId
          },
        ),
      })
    }),
  )
}
