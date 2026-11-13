import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { eq, inArray } from "drizzle-orm"
import { Effect } from "effect"
import { createDatabase } from "../../src/client.js"
import { Database } from "../../src/persistence/database.js"
import { createOwnedProject } from "../../src/persistence/project-access/writes/create-owned-project.js"
import { createProject } from "../../src/persistence/project-access/writes/create-project.js"
import { user } from "../../src/schema/auth.js"
import {
  projectApiKeys,
  personalWorkspaces,
  projects,
  workspaces,
} from "../../src/schema/index.js"

const url = process.env.TEST_DATABASE_URL
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

test(
  "created projects return the stored timestamp with a timezone offset",
  { skip: !url },
  async () => {
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url!).hostname),
      "disposable loopback TEST_DATABASE_URL required",
    )
    const { db, close } = createDatabase(url!)
    const userId = randomUUID()
    const execute = <A, E>(effect: Effect.Effect<A, E, typeof db>) =>
      Effect.runPromise(effect.pipe(Effect.provideService(Database, db)))
    const createdIds: string[] = []
    try {
      await db.insert(user).values({
        id: userId,
        name: "Create project test",
        email: `${userId}@example.test`,
      })
      const owned = await execute(
        createOwnedProject(userId, {
          workspace: "First workspace",
          project: "First project",
        }),
      )
      createdIds.push(owned.projectId)
      const [ownedRow] = await db
        .select({
          createdAt: projects.createdAt,
          workspaceId: projects.workspaceId,
        })
        .from(projects)
        .where(eq(projects.id, owned.projectId))
      assert.ok(ownedRow)
      assert.match(owned.createdAt, timestamp)
      assert.equal(owned.createdAt, ownedRow.createdAt.toISOString())

      const later = await execute(
        createProject(userId, ownedRow.workspaceId, "Second project"),
      )
      createdIds.push(later.projectId)
      const [laterRow] = await db
        .select({ createdAt: projects.createdAt })
        .from(projects)
        .where(eq(projects.id, later.projectId))
      assert.ok(laterRow)
      assert.match(later.createdAt, timestamp)
      assert.equal(later.createdAt, laterRow.createdAt.toISOString())
      assert.notEqual(later.projectId, owned.projectId)
    } finally {
      if (createdIds.length > 0) {
        const rows = await db
          .select({ workspaceId: projects.workspaceId })
          .from(projects)
          .where(inArray(projects.id, createdIds))
        const workspaceIds = rows.map((row) => row.workspaceId)
        await db
          .delete(projectApiKeys)
          .where(inArray(projectApiKeys.projectId, createdIds))
        await db.delete(projects).where(inArray(projects.id, createdIds))
        await db
          .delete(personalWorkspaces)
          .where(eq(personalWorkspaces.userId, userId))
        if (workspaceIds.length > 0) {
          await db
            .delete(workspaces)
            .where(inArray(workspaces.id, workspaceIds))
        }
      }
      await db.delete(user).where(eq(user.id, userId))
      await close()
    }
  },
)
