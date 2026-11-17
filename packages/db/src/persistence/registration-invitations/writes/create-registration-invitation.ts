import { sql } from "drizzle-orm"
import { Effect, Option } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

/** One active invitation per mailbox, including concurrent CLI calls. */
export const createRegistrationInvitation = Effect.fn(
  "createRegistrationInvitation",
)(function* (email: string, tokenHash: string) {
  const db = yield* Database
  const rows = yield* runQuery(
    DatabaseOperation.CreateRegistrationInvitation,
    () =>
      db.execute<{ id: string }>(sql`
        insert into registration_invitations (email, token_hash, expires_at)
        select ${email.trim().toLowerCase()}, ${tokenHash}, now() + interval '24 hours'
        where not exists (select 1 from "user" where lower(email) = ${email.trim().toLowerCase()})
        on conflict (email) do update set
          id = excluded.id, token_hash = excluded.token_hash,
          expires_at = excluded.expires_at, created_at = excluded.created_at
        where registration_invitations.expires_at <= now()
        returning id
      `),
  )
  return Option.fromNullishOr(rows[0])
})
