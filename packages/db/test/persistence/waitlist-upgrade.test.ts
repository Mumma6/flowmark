import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { sql } from "drizzle-orm"
import { createDatabase } from "../../src/client.js"
import { waitlist } from "../../src/schema/waitlist.js"

const url = process.env.TEST_DATABASE_URL

test(
  "welcome migration preserves populated legacy registrations without scheduling mail",
  { skip: !url },
  async () => {
    const connection = createDatabase(url!)
    const id = randomUUID()
    const createdAt = new Date("2026-10-01T12:00:00Z")
    const statements = readFileSync(
      new URL(
        "../../migrations/0033_majestic_imperial_guard.sql",
        import.meta.url,
      ),
      "utf8",
    ).split("--> statement-breakpoint")
    assert.equal(statements.length, 2)
    try {
      await connection.db.transaction(async (tx) => {
        // Session-local legacy table shadows the public table only in this transaction.
        await tx.execute(
          sql`CREATE TEMPORARY TABLE waitlist (id uuid PRIMARY KEY, email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()) ON COMMIT DROP`,
        )
        await tx.execute(
          sql`INSERT INTO waitlist (id, email, created_at) VALUES (${id}::uuid, 'legacy@example.test', ${createdAt.toISOString()}::timestamptz)`,
        )
        await tx.execute(sql.raw(statements[0]!))
        await tx.execute(sql.raw(statements[1]!))
        const [row] = await tx.select().from(waitlist)
        assert.equal(row?.id, id)
        assert.equal(row?.email, "legacy@example.test")
        assert.equal(row?.createdAt.toISOString(), createdAt.toISOString())
        assert.equal(row?.welcomeStartedAt, null)
        assert.equal(row?.welcomeSubmittedAt, null)
      })
    } finally {
      await connection.close()
    }
  },
)
