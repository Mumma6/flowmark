import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { authRateLimits } from "../../../schema/auth.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export interface AuthLimitRule {
  readonly window: number
  readonly max: number
}

/** One atomic fixed-window consume, using the database clock across instances. */
export const consumeAuthRateLimit = Effect.fn("consumeAuthRateLimit")(
  function* (key: string, rule: AuthLimitRule) {
    const db = yield* Database
    // Inputs come from server-owned policy, never from request bodies.
    if (
      !/^[a-f0-9]{64}$/.test(key) ||
      !Number.isInteger(rule.max) ||
      rule.max < 1 ||
      rule.max > 10000 ||
      !Number.isInteger(rule.window) ||
      rule.window < 1 ||
      rule.window > 900
    ) {
      return yield* Effect.die(new Error("Invalid auth limit policy."))
    }
    const rows = yield* runQuery(DatabaseOperation.AuthRateLimit, () =>
      db.execute<{
        allowed: boolean
        retry_after: number
      }>(sql`
    WITH expired AS (
      DELETE FROM ${authRateLimits} WHERE key IN (
        SELECT key FROM ${authRateLimits}
        WHERE expires_at <= statement_timestamp() AND key <> ${key}
        ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
      )
    ), consumed AS (
      INSERT INTO ${authRateLimits} (key, count, expires_at)
      VALUES (${key}, 1, statement_timestamp() + ${rule.window} * interval '1 second')
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN auth_rate_limits.expires_at <= statement_timestamp()
          THEN 1 ELSE auth_rate_limits.count + 1 END,
        expires_at = CASE WHEN auth_rate_limits.expires_at <= statement_timestamp()
          THEN EXCLUDED.expires_at ELSE auth_rate_limits.expires_at END
      WHERE auth_rate_limits.expires_at <= statement_timestamp()
        OR auth_rate_limits.count < ${rule.max}
      RETURNING true AS allowed, 0 AS retry_after
    )
    SELECT allowed, retry_after FROM consumed
    UNION ALL
    SELECT false, greatest(1, coalesce((
      SELECT ceil(extract(epoch FROM (expires_at - statement_timestamp())))::int
      FROM ${authRateLimits} WHERE key = ${key}
    ), ${rule.window})) WHERE NOT EXISTS (SELECT 1 FROM consumed)
  `),
    )
    const result = rows[0]
    if (!result) {
      return yield* Effect.die(
        new Error("Auth limit did not return a decision."),
      )
    }
    return {
      allowed: result.allowed,
      retryAfter: result.allowed ? null : result.retry_after,
    }
  },
)
