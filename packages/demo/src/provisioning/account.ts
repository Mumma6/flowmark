import { Effect, Schema } from "effect"
import { ManageProject } from "@flowmark/api"
import type { FlowmarkDatabase } from "@flowmark/db"
import { Database } from "@flowmark/db/persistence"
import {
  DatasetConflict,
  findFixtureAccount,
  findFixtureProjects,
  withDatasetTransaction,
} from "@flowmark/db/fixtures"
import {
  ACCOUNT_EMAIL,
  ACCOUNT_NAME,
  PROJECT_NAME,
} from "../scenarios/catalog.js"
import { fixtureApi } from "../runtime.js"

export interface AuthHttp {
  readonly request: (
    path: string,
    body?: object,
  ) => Effect.Effect<unknown, DatasetConflict>
}
const Session = Schema.Struct({
  user: Schema.Struct({ id: Schema.String, email: Schema.String }),
})

/** Sign-up is used only when absent; existing accounts must authenticate with their own password. */
export const setupAccount = Effect.fn("Meridian.setupAccount")(function* (
  db: FlowmarkDatabase,
  auth: AuthHttp,
  password: string,
  expectedProjectId?: string,
) {
  if (password.length < 8) {
    return yield* new DatasetConflict({
      reason:
        "Flowmark requires a password of at least eight characters. Security rules were not changed.",
    })
  }
  return yield* withDatasetTransaction(
    db,
    "meridian-account-setup",
    (transaction) =>
      Effect.gen(function* () {
        const existing = yield* findFixtureAccount(ACCOUNT_EMAIL)
        if (expectedProjectId) {
          const previous = existing
            ? yield* findFixtureProjects(existing.id, PROJECT_NAME)
            : []
          if (!previous.some((item) => item.id === expectedProjectId)) {
            return yield* new DatasetConflict({
              reason:
                "Saved account/project identity no longer exists. Refusing automatic replacement.",
            })
          }
        }
        yield* auth.request(existing ? "/sign-in/email" : "/sign-up/email", {
          email: ACCOUNT_EMAIL,
          password,
          ...(!existing ? { name: ACCOUNT_NAME } : {}),
        })
        const session = yield* auth.request("/get-session").pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Session)),
          Effect.mapError(
            () =>
              new DatasetConflict({
                reason:
                  "The ordinary authentication flow did not establish the expected session.",
              }),
          ),
        )
        if (
          session.user.email !== ACCOUNT_EMAIL ||
          (existing && existing.id !== session.user.id)
        ) {
          return yield* new DatasetConflict({
            reason:
              "Authenticated account differs; no existing account was changed.",
          })
        }
        const projects = yield* findFixtureProjects(
          session.user.id,
          PROJECT_NAME,
        )
        if (projects.length > 1) {
          return yield* new DatasetConflict({
            reason:
              "Multiple Meridian projects exist; select one explicitly after inspection.",
          })
        }
        if (projects[0]) {
          return {
            projectId: projects[0].id,
            created: false as const,
            key: undefined,
          }
        }
        const management = yield* ManageProject
        const created = yield* management.create(session.user.id, PROJECT_NAME)
        return {
          projectId: created.project.id,
          created: true as const,
          key: created.writeKey.secret,
        }
      }).pipe(
        Effect.provide(fixtureApi(transaction)),
        Effect.provideService(Database, transaction),
      ),
  )
})
