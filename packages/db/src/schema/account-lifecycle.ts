import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export interface AccountErasureCounts {
  readonly projects: number
  readonly runs: number
  readonly events: number
  readonly apiKeys: number
  readonly oauthClients: number
  readonly delegatedGrants: number
  readonly browserKeys: number
  readonly sharedProjects: number
  readonly unfinishedProjects: number
  readonly previewProjects: ReadonlyArray<{
    readonly id: string
    readonly name: string
  }>
  readonly revision: string
}

/** No user FK: narrowly scoped cleanup survives session/profile removal. */
export const accountLifecycleOperations = pgTable(
  "account_lifecycle_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    counts: jsonb("counts").$type<AccountErasureCounts>().notNull(),
    state: text("state", {
      enum: ["previewed", "purging", "live_data_deleted", "cancelled"],
    })
      .notNull()
      .default("previewed"),
    contractVersion: integer("contract_version").notNull().default(1),
    phase: integer("phase").notNull().default(0),
    completedProjects: integer("completed_projects").notNull().default(0),
    childProjectId: uuid("child_project_id"),
    childOperationId: uuid("child_operation_id"),
    capabilityHash: text("capability_hash").notNull(),
    capabilityExpiresAt: timestamp("capability_expires_at", {
      withTimezone: true,
    }).notNull(),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("account_lifecycle_user_idx").on(table.userId, table.createdAt),
    index("account_lifecycle_expiry_idx").on(table.expiresAt),
  ],
)
