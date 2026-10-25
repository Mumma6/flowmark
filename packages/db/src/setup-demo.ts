import { migrate } from "drizzle-orm/postgres-js/migrator"
import { loadApiEnvironment } from "./load-environment.js"
import {
  createDatabase,
  projects,
  projectApiKeys,
  projectBrowserKeys,
  workspaces,
} from "./index.js"
import {
  DEMO_PROJECT_ID,
  DEMO_WORKSPACE_ID,
  DEMO_READ_KEY,
  DEMO_WRITE_KEY,
  DEMO_BROWSER_KEY,
  DEMO_BROWSER_ORIGINS,
  DIAGNOSTICS_PROJECT_ID,
  DIAGNOSTICS_WRITE_KEY,
  DIAGNOSTICS_BROWSER_KEY,
} from "./demo.js"
import { hashApiKey } from "./store.js"

loadApiEnvironment()

if (process.env.FLOWMARK_DEMO_MODE !== "true") {
  throw new Error(
    "Set FLOWMARK_DEMO_MODE=true explicitly to provision the local development project.",
  )
}
const url = process.env.DATABASE_URL
if (!url) {
  throw new Error(
    "DATABASE_URL is required. Use a dedicated development PostgreSQL database.",
  )
}
const { db, close } = createDatabase(url)
try {
  await migrate(db, {
    migrationsFolder: new URL("../migrations", import.meta.url).pathname,
  })
  await db.transaction(async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: DEMO_WORKSPACE_ID, name: "Flowmark Local Development" })
      .onConflictDoUpdate({
        target: workspaces.id,
        set: { name: "Flowmark Local Development" },
      })
    await tx
      .insert(projects)
      .values({
        id: DEMO_PROJECT_ID,
        workspaceId: DEMO_WORKSPACE_ID,
        name: "Flowmark local development",
      })
      .onConflictDoUpdate({
        target: projects.id,
        set: { name: "Flowmark local development" },
      })
    await tx
      .insert(projectApiKeys)
      .values([
        {
          projectId: DEMO_PROJECT_ID,
          keyHash: hashApiKey(DEMO_WRITE_KEY),
          permission: "write",
        },
        {
          projectId: DEMO_PROJECT_ID,
          keyHash: hashApiKey(DEMO_READ_KEY),
          permission: "read",
        },
      ])
      .onConflictDoNothing()
    await tx
      .insert(projects)
      .values({
        id: DIAGNOSTICS_PROJECT_ID,
        workspaceId: DEMO_WORKSPACE_ID,
        name: "SDK diagnostics (local only)",
      })
      .onConflictDoNothing()
    await tx
      .insert(projectApiKeys)
      .values({
        projectId: DIAGNOSTICS_PROJECT_ID,
        keyHash: hashApiKey(DIAGNOSTICS_WRITE_KEY),
        permission: "write",
      })
      .onConflictDoNothing()
    await tx
      .insert(projectBrowserKeys)
      .values({
        projectId: DIAGNOSTICS_PROJECT_ID,
        keyHash: hashApiKey(DIAGNOSTICS_BROWSER_KEY),
        allowedOrigins: DEMO_BROWSER_ORIGINS,
      })
      .onConflictDoNothing()
    await tx
      .insert(projectBrowserKeys)
      .values({
        projectId: DEMO_PROJECT_ID,
        keyHash: hashApiKey(DEMO_BROWSER_KEY),
        allowedOrigins: DEMO_BROWSER_ORIGINS,
      })
      .onConflictDoNothing()
  })
  console.log(
    "Local development project provisioned. Development-only keys are documented in the development guide.",
  )
} finally {
  await close()
}
