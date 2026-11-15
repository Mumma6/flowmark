import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { user, session } from "./auth.js"

export interface ExportPosition {
  readonly category: number
  readonly after: string
  readonly part: number
}

/** No artifact bytes or credentials; at most twenty rows per user, bounded at admission. */
export const dataExportRequests = pgTable(
  "data_export_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    projectId: uuid("project_id"),
    version: integer("version").notNull().default(1),
    token: uuid("token").notNull(),
    position: jsonb("position").$type<ExportPosition>().notNull(),
    previousToken: uuid("previous_token"),
    previousPosition: jsonb("previous_position").$type<ExportPosition>(),
    state: text("state", { enum: ["ready", "complete", "cancelled"] })
      .notNull()
      .default("ready"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("data_export_user_idx").on(table.userId),
    index("data_export_session_idx").on(table.sessionId),
  ],
)
