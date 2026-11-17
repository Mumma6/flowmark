import { sql } from "drizzle-orm"
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

/** Private account admission only; unrelated to project sharing or the waitlist. */
export const registrationInvitations = pgTable(
  "registration_invitations",
  {
    email: text("email").primaryKey(),
    id: uuid("id").defaultRandom().notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "registration_invitation_email_normalized",
      sql`${table.email} = lower(btrim(${table.email}))`,
    ),
  ],
)
