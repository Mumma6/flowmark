import { sql } from "drizzle-orm"
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    welcomeStartedAt: timestamp("welcome_started_at", { withTimezone: true }),
    welcomeSubmittedAt: timestamp("welcome_submitted_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("waitlist_email_unique").on(sql`lower(${table.email})`),
  ],
)
