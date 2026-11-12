import { createHash } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { Array, Effect, Option, Record } from "effect"
import {
  definitionImportReviewContent,
  previewDefinitionImport,
  type DefinitionImportApply,
  type DefinitionImportReceipt,
} from "@flowmarkdev/core"
import {
  projectMembers,
  workflowDefinitionImports,
  workflowResultDeclarations,
  workflowSearchFields,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { runTransaction } from "../../run-transaction.js"
import { DefinitionImportRejected } from "../definition-import-error.js"
import { getDefinitionSnapshot } from "../queries/get-definition-snapshot.js"
import { lockDefinitionScope } from "./lock-definition-scope.js"

const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex")
const receiptResult = (
  row: typeof workflowDefinitionImports.$inferSelect,
  status: DefinitionImportReceipt["status"],
): DefinitionImportReceipt => ({
  status,
  receiptId: row.id,
  appliedAt: row.createdAt.toISOString(),
  source: row.source,
  workflow: row.workflow,
  resultRevision: row.resultRevision,
  addedSearchKeys: row.addedSearchKeys,
})

export const applyDefinitionImport = Effect.fn("applyDefinitionImport")(
  function* (userId: string, projectId: string, input: DefinitionImportApply) {
    const db = yield* Database
    return yield* runTransaction(
      DatabaseOperation.ApplyDefinitionImport,
      (use) => db.transaction(use),
      (tx) =>
        Effect.gen(function* () {
          // Membership is rechecked and held until commit, including duplicate retries.
          const members = yield* runQuery(
            DatabaseOperation.GetMemberProject,
            () =>
              tx
                .select({ userId: projectMembers.userId })
                .from(projectMembers)
                .where(
                  and(
                    eq(projectMembers.projectId, projectId),
                    eq(projectMembers.userId, userId),
                    eq(projectMembers.role, "owner"),
                  ),
                )
                .limit(1)
                .for("share"),
          )
          if (members.length === 0) {
            return yield* new DefinitionImportRejected({
              reason: "Unauthorized",
            })
          }
          const definition = input.definition
          yield* lockDefinitionScope(tx, projectId, definition.workflow)
          const requestContent = definitionImportReviewContent(
            projectId,
            definition,
            {
              result: Option.none(),
              searchFields: [],
            },
          )
          if (
            fingerprint(requestContent.manifest) !== input.manifestFingerprint
          ) {
            return yield* new DefinitionImportRejected({ reason: "Stale" })
          }
          const prior = yield* runQuery(
            DatabaseOperation.ApplyDefinitionImport,
            () =>
              tx
                .select()
                .from(workflowDefinitionImports)
                .where(
                  and(
                    eq(workflowDefinitionImports.projectId, projectId),
                    eq(workflowDefinitionImports.workflow, definition.workflow),
                    eq(workflowDefinitionImports.source, definition.source),
                    eq(
                      workflowDefinitionImports.manifestFingerprint,
                      input.manifestFingerprint,
                    ),
                    eq(
                      workflowDefinitionImports.baseFingerprint,
                      input.baseFingerprint,
                    ),
                  ),
                )
                .limit(1),
          )
          const previous = Array.head(prior)
          if (Option.isSome(previous)) {
            return receiptResult(previous.value, "AlreadyApplied")
          }

          const snapshot = yield* getDefinitionSnapshot(
            tx,
            projectId,
            definition,
          )
          const content = definitionImportReviewContent(
            projectId,
            definition,
            snapshot,
          )
          if (
            fingerprint(content.manifest) !== input.manifestFingerprint ||
            fingerprint(content.base) !== input.baseFingerprint
          ) {
            return yield* new DefinitionImportRejected({ reason: "Stale" })
          }
          const plan = previewDefinitionImport(definition, snapshot)
          const proposedFields = plan.searchFields.proposed
          if (plan.status === "Conflict" || proposedFields === null) {
            return yield* new DefinitionImportRejected({ reason: "Conflict" })
          }
          const newRevision =
            plan.result.action === "Create" ? definition.result : undefined
          yield* Option.match(Option.fromUndefinedOr(newRevision), {
            onNone: () => Effect.void,
            onSome: (declaration) =>
              runQuery(DatabaseOperation.CreateResultDeclaration, () =>
                tx.insert(workflowResultDeclarations).values({
                  projectId,
                  workflow: definition.workflow,
                  revision: declaration.revision,
                  declaration,
                  source: definition.source,
                }),
              ).pipe(Effect.asVoid),
          })
          if (plan.searchFields.additions.length > 0) {
            const sources = {
              ...snapshot.sources,
              ...Record.fromEntries(
                Array.map(
                  plan.searchFields.additions,
                  (field) => [field.key, definition.source] as const,
                ),
              ),
            }
            yield* runQuery(DatabaseOperation.SetSearchFields, () =>
              tx
                .insert(workflowSearchFields)
                .values({
                  projectId,
                  workflow: definition.workflow,
                  fields: proposedFields,
                  sources,
                })
                .onConflictDoUpdate({
                  target: [
                    workflowSearchFields.projectId,
                    workflowSearchFields.workflow,
                  ],
                  set: { fields: proposedFields, sources },
                }),
            )
          }
          const receipts = yield* runQuery(
            DatabaseOperation.ApplyDefinitionImport,
            () =>
              tx
                .insert(workflowDefinitionImports)
                .values({
                  projectId,
                  workflow: definition.workflow,
                  source: definition.source,
                  actorId: userId,
                  manifestFingerprint: input.manifestFingerprint,
                  baseFingerprint: input.baseFingerprint,
                  resultRevision: newRevision?.revision ?? null,
                  addedSearchKeys: Array.map(
                    plan.searchFields.additions,
                    (field) => field.key,
                  ),
                })
                .returning(),
          )
          return receiptResult(
            Option.getOrThrow(Array.head(receipts)),
            plan.status === "Unchanged" ? "Unchanged" : "Applied",
          )
        }),
    )
  },
)
