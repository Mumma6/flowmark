import { randomUUID } from "node:crypto"
import { Effect } from "effect"
import { user, projectApiKeys, type FlowmarkDatabase } from "@flowmark/db"
import {
  createOwnedProject,
  Database,
  hashApiKey,
} from "@flowmark/db/persistence"
import { getAuth } from "../../../src/auth"

/** Disposable managed-test identities; never reads or provisions a local account. */
export const createDefinitionImportFixture = Effect.fn(
  "test.createDefinitionImportFixture",
)(function* (db: FlowmarkDatabase) {
  const auth = yield* getAuth()
  const password = randomUUID()
  const registered = yield* Effect.promise(() =>
    auth.handler(
      new Request("http://localhost:3001/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          origin: "http://localhost:3001",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Definition fixture",
          email: `definitions-${randomUUID()}@example.test`,
          password,
        }),
      }),
    ),
  )
  if (!registered.ok) {
    throw new Error(`Fixture registration failed (${registered.status})`)
  }
  const cookie = registered.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ")
  const session = yield* Effect.promise(() =>
    auth.api.getSession({ headers: { cookie } }),
  )
  if (!session) {
    throw new Error("Missing fixture session")
  }
  const primary = yield* createOwnedProject(session.user.id, {
    workspace: "Definition preview tests",
    project: "Booking setup",
  }).pipe(Effect.provideService(Database, db))
  const foreignUserId = randomUUID()
  yield* Effect.promise(() =>
    db.insert(user).values({
      id: foreignUserId,
      name: "Foreign fixture",
      email: `${foreignUserId}@example.test`,
    }),
  )
  const foreign = yield* createOwnedProject(foreignUserId, {
    workspace: "Foreign definition tests",
    project: "Foreign booking setup",
  }).pipe(Effect.provideService(Database, db))
  const readKey = `fm_read_${randomUUID()}`
  yield* Effect.promise(() =>
    db.insert(projectApiKeys).values({
      projectId: primary.projectId,
      permission: "read",
      name: "Fixture read",
      keyHash: hashApiKey(readKey),
      keyPrefix: readKey.slice(0, 16),
    }),
  )
  return {
    cookie,
    password,
    userId: session.user.id,
    projectId: primary.projectId,
    foreignProjectId: foreign.projectId,
    readKey,
    writeKey: primary.writeKey.secret,
  }
})
