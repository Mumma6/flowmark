import { eq } from "drizzle-orm"
import { Effect } from "effect"
import {
  projectApiKeys,
  personalWorkspaces,
  user,
  projectMembers,
  projects,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import type { CreatedSecret } from "../types.js"
import { generateProjectKey } from "./generate-project-key.js"

export const createProject = Effect.fn("createProject")(function* (
  userId: string,
  workspaceId: string,
  name: string,
) {
  const db = yield* Database
  const writeKey = generateProjectKey("write")
  const created = yield* runQuery(DatabaseOperation.CreateProject, () =>
    db.transaction(async (tx) => {
      const [actor] = await tx
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .for("share")
      const [home] = await tx
        .select()
        .from(personalWorkspaces)
        .where(eq(personalWorkspaces.userId, userId))
      if (
        !actor ||
        actor.lifecycleOperationId !== null ||
        home?.workspaceId !== workspaceId
      ) {
        throw new Error("Personal project creation target required.")
      }
      const [project] = await tx
        .insert(projects)
        .values({ workspaceId, name })
        .returning({ id: projects.id, createdAt: projects.createdAt })
      const [key] = await tx
        .insert(projectApiKeys)
        .values({
          projectId: project.id,
          keyHash: writeKey.hash,
          permission: "write",
          name: "Write key",
          keyPrefix: writeKey.prefix,
        })
        .returning({ id: projectApiKeys.id })
      await tx.insert(projectMembers).values({
        userId,
        projectId: project.id,
        role: "owner",
      })
      return {
        projectId: project.id,
        createdAt: project.createdAt,
        keyId: key.id,
      }
    }),
  )
  return {
    projectId: created.projectId,
    createdAt: created.createdAt.toISOString(),
    writeKey: {
      id: created.keyId,
      name: "Write key",
      prefix: writeKey.prefix,
      secret: writeKey.secret,
    } satisfies CreatedSecret,
  }
})
