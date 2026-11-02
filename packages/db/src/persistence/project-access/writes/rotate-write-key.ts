import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { projectApiKeys } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import type { CreatedSecret } from "../types.js"
import { generateProjectKey } from "./generate-project-key.js"

export const rotateWriteKey = Effect.fn("rotateWriteKey")(function* (
  projectId: string,
  keyId: string,
) {
  const db = yield* Database
  return yield* runQuery(DatabaseOperation.RotateWriteKey, () =>
    db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          name: projectApiKeys.name,
          permission: projectApiKeys.permission,
        })
        .from(projectApiKeys)
        .where(
          and(
            eq(projectApiKeys.id, keyId),
            eq(projectApiKeys.projectId, projectId),
          ),
        )
        .for("update")
      if (!existing || existing.permission !== "write") {
        return null
      }
      const generated = generateProjectKey("write")
      const [created] = await tx
        .insert(projectApiKeys)
        .values({
          projectId,
          keyHash: generated.hash,
          permission: "write",
          name: existing.name,
          keyPrefix: generated.prefix,
        })
        .returning({ id: projectApiKeys.id })
      if (!created) {
        throw new Error("Write key replacement was not stored.")
      }
      const deleted = await tx
        .delete(projectApiKeys)
        .where(
          and(
            eq(projectApiKeys.id, keyId),
            eq(projectApiKeys.projectId, projectId),
            eq(projectApiKeys.permission, "write"),
          ),
        )
        .returning({ id: projectApiKeys.id })
      if (deleted.length !== 1) {
        throw new Error("Write key disappeared during rotation.")
      }
      return {
        id: created.id,
        name: existing.name,
        prefix: generated.prefix,
        secret: generated.secret,
      } satisfies CreatedSecret
    }),
  )
})
