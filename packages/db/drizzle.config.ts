import { defineConfig } from "drizzle-kit"
import { loadApiEnvironment } from "./src/load-environment"

loadApiEnvironment()

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
