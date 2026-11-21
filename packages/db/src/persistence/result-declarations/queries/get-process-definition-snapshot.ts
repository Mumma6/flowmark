import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { Array, Effect } from "effect"
import type { ProcessDefinition } from "@flowmarkdev/core"
import { workflowDefinitionImports, workflows } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const getProcessDefinitionSnapshot = Effect.fn(
  "getProcessDefinitionSnapshot",
)(function* (projectId: string, process: ProcessDefinition) {
  const db = yield* Database
  const [head] = yield* runQuery(DatabaseOperation.ReadResultDeclarations, () =>
    db
      .select({ reviewed: workflowDefinitionImports.reviewedProcess })
      .from(workflowDefinitionImports)
      .where(
        and(
          eq(workflowDefinitionImports.projectId, projectId),
          eq(workflowDefinitionImports.processKey, process.key),
        ),
      )
      .orderBy(desc(workflowDefinitionImports.processRevision))
      .limit(1),
  )
  const [requested] =
    head?.reviewed && process.revision < head.reviewed.definition.revision
      ? yield* runQuery(DatabaseOperation.ReadResultDeclarations, () =>
          db
            .select({ reviewed: workflowDefinitionImports.reviewedProcess })
            .from(workflowDefinitionImports)
            .where(
              and(
                eq(workflowDefinitionImports.projectId, projectId),
                eq(workflowDefinitionImports.processKey, process.key),
                eq(workflowDefinitionImports.processRevision, process.revision),
              ),
            )
            .limit(1),
        )
      : []
  const names = Array.flatMap(process.members, ({ workflows }) => workflows)
  const observations = yield* runQuery(
    DatabaseOperation.ReadResultDeclarations,
    () =>
      db
        .select({ name: workflows.name })
        .from(workflows)
        .where(
          and(
            eq(workflows.projectId, projectId),
            inArray(workflows.name, names),
          ),
        )
        .orderBy(asc(workflows.name)),
  )
  return {
    previous: head?.reviewed ?? null,
    ...(requested?.reviewed ? { requestedRevision: requested.reviewed } : {}),
    observedWorkflows: Array.map(observations, ({ name }) => name),
  }
})
