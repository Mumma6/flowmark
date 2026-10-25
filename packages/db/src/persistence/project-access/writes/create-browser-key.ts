import { Effect } from "effect"
import { projectBrowserKeys } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import type { CreatedSecret } from "../types.js"
import { generateProjectKey } from "./generate-project-key.js"

export const createBrowserKey = Effect.fn("createBrowserKey")(function* (
  projectId: string,
  input: { readonly name: string; readonly origins: ReadonlyArray<string> },
) {
  const db = yield* Database
  const generated = generateProjectKey("browser")
  const [row] = yield* runQuery(DatabaseOperation.CreateBrowserKey, () =>
    db
      .insert(projectBrowserKeys)
      .values({
        projectId,
        keyHash: generated.hash,
        name: input.name,
        keyPrefix: generated.prefix,
        allowedOrigins: [...input.origins],
      })
      .returning({ id: projectBrowserKeys.id }),
  )
  return {
    id: row.id,
    name: input.name,
    prefix: generated.prefix,
    secret: generated.secret,
  } satisfies CreatedSecret
})
