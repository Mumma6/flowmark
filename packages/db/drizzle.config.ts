import { defineConfig } from "drizzle-kit"
import { Effect } from "effect"
import { loadApiEnvironment } from "./src/environment/load"

Effect.runSync(loadApiEnvironment)

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL ?? "",
  },
})
