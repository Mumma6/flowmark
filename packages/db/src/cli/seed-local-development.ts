import { Effect } from "effect"
import {
  projects,
  projectApiKeys,
  projectBrowserKeys,
  workspaces,
} from "../schema/index.js"
import { withCommandDatabase } from "./connection.js"
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
} from "../fixtures/demo.js"
import { addProjectMember } from "../persistence/project-access/writes/add-project-member.js"
import { seedLocalAuthUser } from "./seed-local-auth.js"
import {
  Database,
  DatabaseError,
  DatabaseOperation,
  hashApiKey,
} from "../persistence/index.js"

export const seedLocalDevelopment = Effect.fn("seedLocalDevelopment")(
  function* (url: string) {
    yield* withCommandDatabase(url, (db) =>
      Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            await tx
              .insert(workspaces)
              .values({
                id: DEMO_WORKSPACE_ID,
                name: "Flowmark Local Development",
              })
              .onConflictDoUpdate({
                target: workspaces.id,
                set: { name: "Flowmark Local Development" },
              })
            await tx
              .insert(projects)
              .values({
                id: DEMO_PROJECT_ID,
                workspaceId: DEMO_WORKSPACE_ID,
                name: "Fieldwork Operations",
              })
              .onConflictDoUpdate({
                target: projects.id,
                set: { name: "Fieldwork Operations" },
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
          }),
        catch: (cause) =>
          new DatabaseError({ operation: DatabaseOperation.Seed, cause }),
      }),
    )
    const userId = yield* seedLocalAuthUser(url)
    yield* withCommandDatabase(url, (db) =>
      addProjectMember(userId, DEMO_PROJECT_ID).pipe(
        Effect.provideService(Database, db),
      ),
    )
  },
)
