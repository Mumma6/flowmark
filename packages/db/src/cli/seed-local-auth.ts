import { eq } from "drizzle-orm"
import { Effect, Option } from "effect"
import { createFlowmarkAuth, readAuthSecret } from "../auth/create-auth.js"
import { createDatabase } from "../client.js"
import {
  LOCAL_DEV_EMAIL,
  LOCAL_DEV_NAME,
  LOCAL_DEV_PASSWORD,
} from "../fixtures/demo.js"
import { DatabaseError } from "../persistence/database.js"
import { DatabaseOperation } from "../persistence/database-operation.js"
import { user } from "../schema/auth.js"

const seedFailure = (cause: unknown) =>
  new DatabaseError({ operation: DatabaseOperation.Seed, cause })

export const seedLocalAuthUser = Effect.fn("seedLocalAuthUser")(function* (
  url: string,
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const connection = yield* Effect.acquireRelease(
        Effect.try({
          try: () => createDatabase(url),
          catch: (cause) =>
            new DatabaseError({ operation: DatabaseOperation.Connect, cause }),
        }),
        ({ close }) =>
          Effect.tryPromise({
            try: close,
            catch: (cause) =>
              new DatabaseError({ operation: DatabaseOperation.Close, cause }),
          }).pipe(Effect.orDie),
      )
      const secret = yield* readAuthSecret().pipe(
        Effect.mapError((error) => seedFailure(error)),
      )
      const auth = createFlowmarkAuth({
        db: connection.db,
        secret,
      })
      const context = yield* Effect.tryPromise({
        try: () => auth.$context,
        catch: seedFailure,
      })
      const existing = yield* Effect.tryPromise({
        try: () => context.internalAdapter.findUserByEmail(LOCAL_DEV_EMAIL),
        catch: seedFailure,
      })
      yield* Option.match(Option.fromNullishOr(existing?.user.id), {
        onSome: () => Effect.void,
        onNone: () =>
          Effect.gen(function* () {
            const created = yield* Effect.tryPromise({
              try: () =>
                context.internalAdapter.createUser(
                  {
                    email: LOCAL_DEV_EMAIL,
                    name: LOCAL_DEV_NAME,
                    emailVerified: true,
                  },
                  { method: "email-password" },
                ),
              catch: seedFailure,
            })
            const hash = yield* Effect.tryPromise({
              try: () => context.password.hash(LOCAL_DEV_PASSWORD),
              catch: seedFailure,
            })
            yield* Effect.tryPromise({
              try: () =>
                context.internalAdapter.linkAccount({
                  userId: created.id,
                  providerId: "credential",
                  accountId: created.id,
                  password: hash,
                }),
              catch: seedFailure,
            })
          }),
      })
      const rows = yield* Effect.tryPromise({
        try: () =>
          connection.db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, LOCAL_DEV_EMAIL))
            .limit(1),
        catch: seedFailure,
      })
      return yield* Option.match(Option.fromNullishOr(rows[0]?.id), {
        onNone: () =>
          Effect.fail(
            seedFailure(
              new Error("Failed to provision the local development account."),
            ),
          ),
        onSome: (userId) => Effect.succeed(userId),
      })
    }),
  )
})
