import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { createDatabase } from "../../src/client.js"
import { Database } from "../../src/persistence/database.js"
import { joinWaitlist } from "../../src/persistence/waitlist/writes/join-waitlist.js"
import { waitlist } from "../../src/schema/waitlist.js"

const url = process.env.TEST_DATABASE_URL
test(
  "waitlist joins are atomic and case-insensitive without changing the original row",
  { skip: !url },
  async () => {
    const connection = createDatabase(url!)
    const email = `waitlist-${randomUUID()}@example.test`
    const normalized = sql`lower(${waitlist.email}) = ${email}`
    try {
      await Effect.runPromise(
        joinWaitlist(email).pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      const [original] = await connection.db
        .select()
        .from(waitlist)
        .where(normalized)
      assert.ok(original)
      assert.match(original.id, /^[a-f0-9-]{36}$/)
      assert.ok(original.createdAt instanceof Date)
      await Effect.runPromise(
        Effect.forEach(
          [email.toUpperCase(), email, email.toUpperCase(), email],
          (address) => joinWaitlist(address),
          { concurrency: 4 },
        ).pipe(Effect.provideService(Database, connection.db)),
      )
      const rows = await connection.db.select().from(waitlist).where(normalized)
      assert.equal(rows.length, 1)
      assert.deepEqual(rows[0], original)
      // Also enforce uniqueness for writers outside this use case.
      await assert.rejects(
        connection.db.insert(waitlist).values({ email: email.toUpperCase() }),
      )
    } finally {
      await connection.db.delete(waitlist).where(normalized)
      await connection.close()
    }
  },
)
