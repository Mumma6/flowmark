import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase, projectApiKeys, workflowRuns } from "@flowmark/db"
import { hashApiKey } from "@flowmark/db/persistence"
import { POST as register } from "../../app/api/register/route"
import { POST as auth } from "../../app/api/auth/[...all]/route"
import { POST as ingest } from "../../app/v1/events/route"
import { appRouter } from "../../src/adapters/trpc"

const origin = "http://localhost:3001"

const jsonRequest = (path: string, body: unknown, cookie?: string) =>
  new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })

const caller = (cookie: string, projectId?: string) =>
  appRouter.createCaller({
    request: new Request(`${origin}/api/trpc`, {
      headers: {
        cookie,
        ...(projectId ? { "x-flowmark-project-id": projectId } : {}),
      },
    }),
  })

async function registerAndSignIn() {
  const email = `flowmark-${randomUUID()}@example.com`
  const password = `test-${randomUUID()}`
  const registered = await register(
    jsonRequest("/api/register", {
      name: "Integration owner",
      email,
      password,
    }),
  )
  expect(registered.status).toBe(200)
  expect(await registered.json()).toEqual({ ok: true })

  const signedIn = await auth(
    jsonRequest("/api/auth/sign-in/email", { email, password }),
  )
  expect(signedIn.status).toBe(200)
  const cookies = signedIn.headers.getSetCookie()
  expect(cookies.length).toBeGreaterThan(0)
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ")
}

async function createOwner(name: string) {
  const cookie = await registerAndSignIn()
  const created = await caller(cookie).project.create({ name })
  return { cookie, ...created }
}

async function sendRun(key: string, runId = randomUUID()) {
  const timestamp = new Date().toISOString()
  for (const event of [
    { type: "started", workflow: "integration.import", runId, timestamp },
    {
      type: "completed",
      workflow: "integration.import",
      runId,
      timestamp,
      result: { processed: 3 },
    },
  ]) {
    const response = await ingest(
      new Request("http://localhost/v1/events", {
        method: "POST",
        headers: { authorization: `Bearer ${key}` },
        body: JSON.stringify({ eventId: randomUUID(), event }),
      }),
    )
    expect(response.status).toBe(202)
  }
  return runId
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "authenticated ingestion and session project isolation",
  () => {
    let connection: ReturnType<typeof createDatabase>

    beforeAll(() => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("BETTER_AUTH_SECRET", `${randomUUID()}${randomUUID()}`)
      vi.stubEnv("BETTER_AUTH_URL", origin)
      vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", origin)
      vi.stubEnv("VERCEL_ENV", "")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })

    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })

    it("registers, signs in, creates a project/key, ingests, persists, and reads with its session", async () => {
      const cookie = await registerAndSignIn()
      // Registration creates the identity only, not a project or API key.
      expect(await caller(cookie).project.list()).toEqual([])
      const created = await caller(cookie).project.create({
        name: "Import pipeline",
      })
      expect(created.project.name).toBe("Import pipeline")
      const projectId = created.project.id
      const owner = caller(cookie, projectId)
      const key = await owner.project.createWriteKey({
        projectId,
        name: "Worker",
      })

      const [storedKey] = await connection.db
        .select({ hash: projectApiKeys.keyHash })
        .from(projectApiKeys)
        .where(eq(projectApiKeys.id, key.id))
      expect(storedKey.hash).toBe(hashApiKey(key.secret))
      expect(storedKey.hash).not.toBe(key.secret)
      const listedKeys = await owner.project.keys(projectId)
      expect(
        listedKeys.apiKeys.find((row) => row.id === key.id),
      ).not.toHaveProperty("secret")

      const externalId = await sendRun(key.secret)
      const snapshot = await owner.project.snapshot()
      expect(snapshot.runs).toHaveLength(1)
      const run = snapshot.runs[0]
      expect(run).toMatchObject({
        externalId,
        workflow: "integration.import",
        status: "Completed",
      })
      const timeline = await owner.run.detail({ id: run.id })
      expect(timeline.map((event) => event.type)).toEqual([
        "started",
        "completed",
      ])
      expect(timeline[1].result).toEqual({ processed: 3 })
      const [storedRun] = await connection.db
        .select({ result: workflowRuns.result })
        .from(workflowRuns)
        .where(eq(workflowRuns.id, run.id))
      expect(storedRun.result).toEqual({ processed: 3 })
    })

    it("does not widen a signed-in user's access through a project header or management input", async () => {
      const alice = await createOwner("Alice import")
      const bob = await createOwner("Bob import")
      await sendRun(alice.writeKey.secret)
      const aliceReader = caller(alice.cookie, alice.project.id)
      const [run] = (await aliceReader.project.snapshot()).runs
      const bobReader = caller(bob.cookie, bob.project.id)
      expect(await bobReader.project.list()).toEqual([
        expect.objectContaining({ id: bob.project.id }),
      ])
      expect((await bobReader.project.snapshot()).runs).toEqual([])
      expect(await bobReader.run.detail({ id: run.id })).toEqual([])

      const forged = caller(bob.cookie, alice.project.id)
      await expect(forged.project.snapshot()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
      await expect(forged.run.detail({ id: run.id })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
      await expect(
        bobReader.project.keys(alice.project.id),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      await expect(
        bobReader.project.createWriteKey({
          projectId: alice.project.id,
          name: "Forbidden",
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      await expect(
        bobReader.project.rename({
          projectId: alice.project.id,
          name: "Forbidden",
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      // Denied writes must not mutate the owner's project or create a key.
      expect((await aliceReader.project.list())[0].name).toBe("Alice import")
      expect(
        (await aliceReader.project.keys(alice.project.id)).apiKeys,
      ).toHaveLength(2)
      expect(await aliceReader.run.detail({ id: run.id })).toHaveLength(2)
    })

    it("rejects anonymous and forged sessions and invalidates a signed-out session", async () => {
      await expect(
        caller("").project.create({ name: "Anonymous" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      await expect(
        caller("better-auth.session_token=forged").project.create({
          name: "Forged",
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      const owner = await createOwner("Session lifetime")
      const signedOut = await auth(
        jsonRequest("/api/auth/sign-out", {}, owner.cookie),
      )
      expect(signedOut.status).toBe(200)
      await expect(caller(owner.cookie).project.list()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
    })
  },
)
