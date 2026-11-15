import { createHash, randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { Array, Effect, Option } from "effect"
import { exportCategories } from "../categories.js"
import { dataExportRequests } from "../../../schema/data-exports.js"
import { load, query, transaction } from "../access.js"
import { DataExportRejected } from "../types.js"
export const readExportPart = Effect.fn("DataExports.part")(function* (
  userId: string,
  sessionId: string,
  id: string,
  cursor: string,
) {
  return yield* transaction((tx) =>
    Effect.gen(function* () {
      const row = yield* load(tx, userId, sessionId, id)
      const replay = cursor === row.previousToken
      const position = replay
        ? row.previousPosition
        : cursor === row.token && row.state === "ready"
          ? row.position
          : null
      if (position === null) {
        return yield* new DataExportRejected({ reason: "InvalidCursor" })
      }
      const categories = exportCategories(userId, row.projectId)
      const first = yield* Array.get(categories, position.category).pipe(
        Option.match({
          onNone: () =>
            Effect.fail(new DataExportRejected({ reason: "InvalidCursor" })),
          onSome: Effect.succeed,
        }),
      )
      const collected = yield* Effect.reduce(
        Array.drop(categories, position.category),
        () => ({
          lines: [] as string[],
          bytes: 0,
          records: 0,
          stopped: false,
          next: {
            category: position.category,
            after: position.after,
            part: position.part + 1,
          },
        }),
        (state, category) =>
          Effect.gen(function* () {
            if (state.stopped) {
              return state
            }
            const after = state.next.after
            const remaining = 100 - state.records
            const rows = yield* query(() =>
              tx.execute<{ key: string; value: unknown; oversized: boolean }>(
                sql`WITH selected AS (SELECT ${category.key} AS key, ${category.value} AS value FROM ${category.table} e WHERE ${category.predicate} ${category.cutoff ? sql`AND e.created_at <= ${row.createdAt.toISOString()}` : sql``} AND ${category.after(after)} ORDER BY ${category.key} LIMIT ${remaining + 1}) SELECT key, CASE WHEN octet_length(value::text)<=262144 THEN value ELSE NULL END AS value, octet_length(value::text)>262144 AS oversized FROM selected ORDER BY key`,
              ),
            )
            if (Array.some(rows, (entry) => entry.oversized)) {
              return yield* new DataExportRejected({
                reason: "OversizedRecord",
              })
            }
            const candidates = Array.take(rows, remaining)
            const scan = Array.mapAccum(
              candidates,
              state.bytes,
              (bytes, entry) => {
                const line =
                  JSON.stringify({
                    category: category.name,
                    data: entry.value,
                  }) + "\n"
                return [
                  bytes + Buffer.byteLength(line),
                  {
                    line,
                    key: entry.key,
                    total: bytes + Buffer.byteLength(line),
                  },
                ] as const
              },
            )[1]
            const included = Array.takeWhile(
              scan,
              (entry) => entry.total <= 1048576,
            )
            const last = included.at(-1)
            const exhausted = rows.length === included.length
            const records = state.records + included.length
            return {
              lines: [
                ...state.lines,
                ...Array.map(included, (entry) => entry.line),
              ],
              bytes: last?.total ?? state.bytes,
              records,
              stopped: !exhausted || records === 100,
              next: {
                category: exhausted
                  ? state.next.category + 1
                  : state.next.category,
                after: exhausted ? "" : (last?.key ?? after),
                part: position.part + 1,
              },
            }
          }),
      )
      const lines = collected.lines
      const nextPosition = collected.next
      const complete = nextPosition.category >= categories.length
      const nextCursor = replay ? row.token : randomUUID()
      const header =
        JSON.stringify({
          type: "manifest",
          version: 1,
          encoding: "UTF-8",
          format: "NDJSON",
          exportId: id,
          scope:
            row.projectId === null
              ? "account-personal-data"
              : "owner-project-data",
          projectId: row.projectId,
          cutoff: row.createdAt.toISOString(),
          observedAt: new Date().toISOString(),
          part: position.part,
          startCategory: first.name,
          included: Array.map(categories, (entry) => entry.name),
          excluded: [
            "passwords",
            "sessions",
            "tokens",
            "verification-values",
            "key-secrets-and-hashes",
            "security-counters",
            "other-users-private-selections",
            "derived-facts-and-captures",
            "backups-and-provider-logs",
          ],
          consistency:
            "Rows created after cutoff are excluded where creation timestamps exist. Values are read live per part; updates, retention and deletions can change later parts and retries. This is not a transaction snapshot or a legal portability determination.",
        }) + "\n"
      const content = header + lines.join("")
      const digest = createHash("sha256").update(content).digest("hex")
      const body =
        content +
        JSON.stringify({
          type: "part-end",
          records: lines.length,
          sha256: digest,
          hashes: "All preceding UTF-8 bytes in this part",
          complete,
          nextCursor: complete ? null : nextCursor,
        }) +
        "\n"
      if (!replay) {
        yield* query(() =>
          tx
            .update(dataExportRequests)
            .set({
              previousToken: cursor,
              previousPosition: position,
              token: nextCursor,
              position: nextPosition,
              state: complete ? "complete" : "ready",
            })
            .where(eq(dataExportRequests.id, id)),
        )
      }
      return {
        body,
        complete,
        nextCursor: complete ? null : nextCursor,
        part: position.part,
        filename: `flowmark-${row.projectId === null ? "account" : "project"}-${id}-part-${position.part}.ndjson`,
        bytes: Buffer.byteLength(body),
      }
    }),
  )
})
