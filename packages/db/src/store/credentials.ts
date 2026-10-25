import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { projectApiKeys, projectBrowserKeys } from "../schema.js"
import { Database, DatabaseError, hashApiKey } from "./database.js"

export const authenticateKey = Effect.fn("authenticateKey")(function* (
  key: string,
  permission: "read" | "write",
) {
  const db = yield* Database
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .select({ projectId: projectApiKeys.projectId })
        .from(projectApiKeys)
        .where(
          and(
            eq(projectApiKeys.keyHash, hashApiKey(key)),
            eq(projectApiKeys.permission, permission),
          ),
        )
        .limit(1),
    catch: (cause) => new DatabaseError({ operation: "authenticate", cause }),
  })

  return rows[0]?.projectId
})

export const authenticateBrowserKey = Effect.fn("authenticateBrowserKey")(
  function* (key: string) {
    const db = yield* Database
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: projectBrowserKeys.id,
            projectId: projectBrowserKeys.projectId,
            allowedOrigins: projectBrowserKeys.allowedOrigins,
          })
          .from(projectBrowserKeys)
          .where(eq(projectBrowserKeys.keyHash, hashApiKey(key)))
          .limit(1),
      catch: (cause) =>
        new DatabaseError({ operation: "authenticate-browser", cause }),
    })
    return rows.at(0)
  },
)

export const browserOriginAllowed = Effect.fn("browserOriginAllowed")(
  function* (origin: string) {
    const db = yield* Database
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: projectBrowserKeys.id })
          .from(projectBrowserKeys)
          .where(
            sql`${projectBrowserKeys.allowedOrigins} @> ${JSON.stringify([origin])}::jsonb`,
          )
          .limit(1),
      catch: (cause) =>
        new DatabaseError({ operation: "browser-origin", cause }),
    })
    return rows.length > 0
  },
)

export const consumeBrowserQuota = Effect.fn("consumeBrowserQuota")(function* (
  keyId: string,
) {
  const db = yield* Database
  const expired = sql`${projectBrowserKeys.rateWindowStartedAt} <= now() - interval '1 minute'`
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .update(projectBrowserKeys)
        .set({
          rateWindowStartedAt: sql`CASE WHEN ${expired} THEN now() ELSE ${projectBrowserKeys.rateWindowStartedAt} END`,
          rateWindowCount: sql`CASE WHEN ${expired} THEN 1 ELSE ${projectBrowserKeys.rateWindowCount} + 1 END`,
        })
        .where(
          and(
            eq(projectBrowserKeys.id, keyId),
            sql`(${expired} OR ${projectBrowserKeys.rateWindowCount} < 120)`,
          ),
        )
        .returning({ id: projectBrowserKeys.id }),
    catch: (cause) =>
      new DatabaseError({ operation: "browser-rate-limit", cause }),
  })
  return rows.length > 0
})
