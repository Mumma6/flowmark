import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { sql } from "drizzle-orm"
import { Cause, Effect, Exit } from "effect"
import { createDatabase } from "../../src/client.js"
import {
  DatabaseCancellation,
  InvalidResultQuery,
} from "../../src/persistence/database.js"
import { DatabaseOperation } from "../../src/persistence/database-operation.js"
import { runQuery } from "../../src/persistence/run-query.js"
import { runTransaction } from "../../src/persistence/run-transaction.js"

const url = process.env.TEST_DATABASE_URL

test(
  "transaction bridge preserves failures, rolls back and joins interruption cleanup",
  { skip: !url },
  async () => {
    const connection = createDatabase(url!, { statementTimeoutMs: 3000 })
    const observer = createDatabase(url!)
    const name = `transaction_test_${randomUUID().replaceAll("-", "")}`
    const table = sql.identifier(name)
    const transaction = <A, E>(
      use: Parameters<typeof runTransaction<A, E, never>>[2],
    ) =>
      runTransaction(
        DatabaseOperation.AppendEvent,
        (body) => connection.db.transaction(body),
        use,
      ).pipe(Effect.provideService(DatabaseCancellation, connection.cancel))
    try {
      await observer.db.execute(sql`CREATE TABLE ${table} (id integer)`)
      assert.equal(
        await Effect.runPromise(
          transaction((tx) =>
            runQuery(DatabaseOperation.AppendEvent, () =>
              tx.execute(sql`INSERT INTO ${table} VALUES (1)`),
            ).pipe(Effect.as("committed")),
          ),
        ),
        "committed",
      )
      const expected = new InvalidResultQuery({
        message: "intentional rollback",
      })
      const failed = await Effect.runPromiseExit(
        transaction((tx) =>
          runQuery(DatabaseOperation.AppendEvent, () =>
            tx.execute(sql`INSERT INTO ${table} VALUES (2)`),
          ).pipe(Effect.andThen(Effect.fail(expected))),
        ),
      )
      assert.ok(Exit.isFailure(failed))
      assert.equal(
        failed.cause.reasons.find(Cause.isFailReason)?.error,
        expected,
      )
      const defect = new Error("intentional defect")
      const died = await Effect.runPromiseExit(
        transaction(() => Effect.die(defect)),
      )
      assert.ok(Exit.isFailure(died))
      assert.equal(died.cause.reasons.find(Cause.isDieReason)?.defect, defect)

      const cleanup: string[] = []
      const controller = new AbortController()
      const marker = `transaction-sleep-${randomUUID()}`
      const started = Date.now()
      const pending = Effect.runPromiseExit(
        transaction((tx) =>
          Effect.scoped(
            Effect.gen(function* () {
              yield* Effect.addFinalizer(() =>
                Effect.sync(() => {
                  cleanup.push("child")
                }),
              )
              yield* runQuery(DatabaseOperation.AppendEvent, () =>
                tx.execute(sql`INSERT INTO ${table} VALUES (3)`),
              )
              yield* runQuery(DatabaseOperation.AppendEvent, () =>
                tx.execute(sql`SELECT pg_sleep(20), ${marker}::text`),
              )
            }),
          ),
        ).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              cleanup.push("owner")
            }),
          ),
        ),
        { signal: controller.signal },
      )
      const timer = setTimeout(() => controller.abort(), 150)
      const interrupted = await pending
      clearTimeout(timer)
      assert.ok(
        Exit.isFailure(interrupted) && Cause.hasInterrupts(interrupted.cause),
      )
      assert.deepEqual(cleanup, ["child", "owner"])
      assert.ok(
        Date.now() - started < 2000,
        "interruption must cancel SQL rather than wait for statement timeout",
      )
      const rows = await observer.db.execute<{ id: number }>(
        sql`SELECT id FROM ${table} ORDER BY id`,
      )
      assert.deepEqual(
        rows.map((row) => row.id),
        [1],
        "failed and interrupted writes must roll back before returning",
      )
      const active = await observer.db.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid() AND query LIKE ${`%${marker}%`}`,
      )
      assert.equal(active[0]?.count, 0)
    } finally {
      await observer.db.execute(sql`DROP TABLE IF EXISTS ${table}`)
      await connection.close()
      await observer.close()
    }
  },
)
