import { sql } from "drizzle-orm"
import { createDatabase } from "./index.js"
import { DEMO_PROJECT_ID } from "./demo.js"
import { loadApiEnvironment } from "./load-environment.js"

loadApiEnvironment()

const url = process.env.DATABASE_URL
if (!url || process.env.FLOWMARK_DEMO_MODE !== "true") {
  throw new Error(
    "Local telemetry reset requires DATABASE_URL and FLOWMARK_DEMO_MODE=true.",
  )
}
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("Refusing telemetry reset: the database must be on loopback.")
}
if (!process.argv.includes("--confirm-local-telemetry")) {
  throw new Error(
    "Pass --confirm-local-telemetry to delete only the local development project's telemetry. Accounts and credentials are retained.",
  )
}

const { db, close } = createDatabase(url)
try {
  await db.transaction(async (tx) => {
    const events = await tx.execute(sql`
      DELETE FROM workflow_events WHERE run_id IN (
        SELECT r.id FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id
        WHERE w.project_id=${DEMO_PROJECT_ID}
      ) RETURNING id`)
    const runs = await tx.execute(sql`
      DELETE FROM workflow_runs WHERE workflow_id IN (
        SELECT id FROM workflows WHERE project_id=${DEMO_PROJECT_ID}
      ) RETURNING id`)
    const workflows = await tx.execute(sql`
      DELETE FROM workflows WHERE project_id=${DEMO_PROJECT_ID} RETURNING id`)
    console.log(
      `Deleted local telemetry: ${events.length} events, ${runs.length} runs, ${workflows.length} workflows. Other projects, accounts and keys were not changed.`,
    )
  })
} finally {
  await close()
}
