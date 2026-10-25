import { randomBytes } from "node:crypto"
import { Effect } from "effect"
import {
  projectApiKeys,
  projectMembers,
  projects,
  workspaces,
} from "../../../schema/index.js"
import { Database, hashApiKey } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

const projectKey = (permission: "read" | "write") =>
  `fm_${permission}_${randomBytes(24).toString("base64url")}`

export const createOwnedProject = Effect.fn("createOwnedProject")(function* (
  userId: string,
  names: { readonly workspace: string; readonly project: string },
) {
  const db = yield* Database
  const writeKey = projectKey("write")
  const readKey = projectKey("read")
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
          keyHash: hashApiKey(writeKey),
          permission: "write",
        },
        {
          projectId: project.id,
          keyHash: hashApiKey(readKey),
          permission: "read",
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
  return { projectId, writeKey, readKey }
})
