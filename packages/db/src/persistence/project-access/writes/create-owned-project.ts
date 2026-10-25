import { Effect } from "effect"
import {
  projectApiKeys,
  projectMembers,
  projects,
  workspaces,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { generateProjectKey } from "./generate-project-key.js"

export const createOwnedProject = Effect.fn("createOwnedProject")(function* (
  userId: string,
  names: { readonly workspace: string; readonly project: string },
) {
  const db = yield* Database
  const writeKey = generateProjectKey("write")
  const readKey = generateProjectKey("read")
  const projectId = yield* runQuery(DatabaseOperation.CreateOwnedProject, () =>
    db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({ name: names.workspace })
        .returning({ id: workspaces.id })
      const [project] = await tx
        .insert(projects)
        .values({
          workspaceId: workspace.id,
          name: names.project,
        })
        .returning({ id: projects.id })
      await tx.insert(projectApiKeys).values([
        {
          projectId: project.id,
          keyHash: writeKey.hash,
          permission: "write",
          name: "Write key",
          keyPrefix: writeKey.prefix,
        },
        {
          projectId: project.id,
          keyHash: readKey.hash,
          permission: "read",
          name: "Read key",
          keyPrefix: readKey.prefix,
        },
      ])
      await tx.insert(projectMembers).values({
        userId,
        projectId: project.id,
        role: "owner",
      })
      return project.id
    }),
  )
  return { projectId, writeKey: writeKey.secret, readKey: readKey.secret }
})
