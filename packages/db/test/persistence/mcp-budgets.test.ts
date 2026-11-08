import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { sql } from "drizzle-orm"
import { Array, Effect, Result } from "effect"
import { createDatabase } from "../../src/client.js"
import { Database } from "../../src/persistence/database.js"
import { consumeMcpBudget } from "../../src/persistence/project-access/writes/consume-mcp-budget.js"

const url = process.env.TEST_DATABASE_URL
test(
  "MCP admission is atomic across instances and driver reads cancel on interruption",
  { skip: !url },
  async () => {
    const left = createDatabase(url!)
    const right = createDatabase(url!)
    try {
      const scope = `grant:${randomUUID()}`
      const decisions = await Promise.all(
        Array.map(Array.range(0, 39), (index) =>
          Effect.runPromise(
            consumeMcpBudget(scope, 10).pipe(
              Effect.provideService(Database, index % 2 ? left.db : right.db),
            ),
          ),
        ),
      )
      assert.equal(decisions.filter((decision) => decision.allowed).length, 10)
      assert.ok(
        decisions
          .filter((decision) => !decision.allowed)
          .every((decision) => (decision.retryAfter ?? 0) > 0),
      )
      assert.equal(
        (
          await Effect.runPromise(
            consumeMcpBudget(`grant:${randomUUID()}`, 10).pipe(
              Effect.provideService(Database, left.db),
            ),
          )
        ).allowed,
        true,
      )
      const controller = new AbortController()
      const active = createDatabase(url!, {
        signal: controller.signal,
        statementTimeoutMs: 2000,
      })
      const marker = `mcp-cancel-${randomUUID()}`
      try {
        const started = Date.now()
        const pending = Promise.resolve(
          active.db.execute(sql`SELECT pg_sleep(20), ${marker}::text`),
        ).then(
          () => false,
          () => true,
        )
        const timer = setTimeout(() => controller.abort(), 150)
        assert.equal(await pending, true)
        clearTimeout(timer)
        assert.ok(
          Date.now() - started < 1500,
          "driver cancellation must not wait for the SQL deadline",
        )
        const running = await left.db.execute<{ count: number }>(
          sql`SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND state = 'active' AND query LIKE ${`%${marker}%`}`,
        )
        assert.equal(running[0]?.count, 0)
      } finally {
        await active.close()
      }
      const bounded = createDatabase(url!, { statementTimeoutMs: 50 })
      try {
        const result = await Effect.runPromise(
          Effect.result(
            Effect.tryPromise(() =>
              bounded.db.execute(sql`SELECT pg_sleep(10)`),
            ),
          ),
        )
        assert.equal(Result.isFailure(result), true)
      } finally {
        await bounded.close()
      }
    } finally {
      await left.close()
      await right.close()
    }
  },
)
