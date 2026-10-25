import { Effect } from "effect"
import { projectApiKeys } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import type { CreatedSecret } from "../types.js"
import { generateProjectKey } from "./generate-project-key.js"

export const createApiKey = Effect.fn("createApiKey")(function* (
  projectId: string,
  input: { readonly name: string; readonly permission: "read" | "write" },
) {
  const db = yield* Database
  const generated = generateProjectKey(input.permission)
  const [row] = yield* runQuery(DatabaseOperation.CreateApiKey, () =>
    db
      .insert(projectApiKeys)
      .values({
        projectId,
        keyHash: generated.hash,
        permission: input.permission,
        name: input.name,
        keyPrefix: generated.prefix,
      })
      .returning({ id: projectApiKeys.id }),
  )
  return {
    id: row.id,
    name: input.name,
    prefix: generated.prefix,
    secret: generated.secret,
  } satisfies CreatedSecret
})
