import { createDatabase, session, user } from "@flowmark/db"
import { eq, inArray } from "drizzle-orm"
import { expect } from "vitest"

/** Registration keeps provider auto sign-in, then tests drop that hidden session. */
export async function revokeAutomaticSignupSessions(email: string) {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error("TEST_DATABASE_URL is required to revoke signup sessions.")
  }
  const connection = createDatabase(url)
  try {
    const [account] = await connection.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
    expect(account?.id).toEqual(expect.any(String))
    const existing = await connection.db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, account!.id))
    expect(existing.length).toBeGreaterThan(0)
    await connection.db.delete(session).where(eq(session.userId, account!.id))
  } finally {
    await connection.close()
  }
}

export async function revokeSessionsForEmails(emails: ReadonlyArray<string>) {
  const unique = [...new Set(emails)]
  if (unique.length === 0 || !process.env.TEST_DATABASE_URL) {
    return
  }
  const connection = createDatabase(process.env.TEST_DATABASE_URL)
  try {
    const accounts = await connection.db
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.email, unique))
    if (accounts.length === 0) {
      return
    }
    await connection.db.delete(session).where(
      inArray(
        session.userId,
        accounts.map((account) => account.id),
      ),
    )
  } finally {
    await connection.close()
  }
}
