import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export type ErasureScope =
  | { readonly kind: "project" }
  | { readonly kind: "runs"; readonly runIds: ReadonlyArray<string> }
  | {
      readonly kind: "workflow"
      readonly workflow: string
      readonly after: string
      readonly before: string
    }

export interface ErasureCounts {
  readonly runs: number
  readonly events: number
  readonly apiKeys: number
  readonly browserKeys: number
  readonly configurations: number
  readonly latestStart: string | null
  readonly revision: string
}

/** Intentionally no target FK: completion remains readable after parent erasure. */
export const dataLifecycleOperations = pgTable(
  "data_lifecycle_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: text("actor_id").notNull(),
    projectId: uuid("project_id").notNull(),
    projectName: text("project_name").notNull(),
    scope: jsonb("scope").$type<ErasureScope>().notNull(),
    counts: jsonb("counts").$type<ErasureCounts>().notNull(),
    state: text("state", {
      enum: ["previewed", "purging", "live_data_deleted", "cancelled"],
    })
      .notNull()
      .default("previewed"),
    contractVersion: integer("contract_version").notNull().default(1),
    phase: integer("phase").notNull().default(0),
    deletedEvents: integer("deleted_events").notNull().default(0),
    deletedRuns: integer("deleted_runs").notNull().default(0),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("data_lifecycle_actor_project_idx").on(
      table.actorId,
      table.projectId,
      table.createdAt,
    ),
    index("data_lifecycle_expiry_idx").on(table.expiresAt),
  ],
)
