import { Array, Schema } from "effect"

const Id = Schema.String.check(
  Schema.isPattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ),
)
const Timestamp = Schema.String.check(
  Schema.isMaxLength(40),
  Schema.makeFilter(
    (value) =>
      Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/.test(value),
  ),
)
export const ErasureScopeSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("project") }),
  Schema.Struct({
    kind: Schema.Literal("runs"),
    runIds: Schema.Array(Id).check(
      Schema.isMinLength(1),
      Schema.isMaxLength(100),
      Schema.makeFilter((ids) => Array.dedupe(ids).length === ids.length),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("workflow"),
    workflow: Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(200),
    ),
    after: Timestamp,
    before: Timestamp,
  }).check(
    Schema.makeFilter(
      (scope) => Date.parse(scope.after) < Date.parse(scope.before),
    ),
  ),
])
export type ErasureScope = typeof ErasureScopeSchema.Type

export interface ErasureOperation {
  readonly id: string
  readonly projectId: string
  readonly projectName: string
  readonly scope: ErasureScope
  readonly counts: {
    readonly runs: number
    readonly events: number
    readonly apiKeys: number
    readonly browserKeys: number
    readonly configurations: number
    readonly latestStart: string | null
  }
  readonly state: "previewed" | "purging" | "live_data_deleted" | "cancelled"
  readonly phase: number
  readonly deletedEvents: number
  readonly deletedRuns: number
  readonly failureCode: string | null
  readonly expiresAt: string
}
