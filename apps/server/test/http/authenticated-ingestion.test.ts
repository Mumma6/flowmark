import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase, projectApiKeys, workflowRuns } from "@flowmark/db"
import { hashApiKey } from "@flowmark/db/persistence"
import { POST as register } from "../../app/api/register/route"
import { GET as authGet, POST as auth } from "../../app/api/auth/[...all]/route"
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
  const password = randomUUID()
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
      outcome: "partial",
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
    const applicationName = `flowmark-lifecycle-${randomUUID()}`

    beforeAll(() => {
      const runtimeUrl = new URL(process.env.TEST_DATABASE_URL!)
      runtimeUrl.searchParams.set("application_name", applicationName)
      vi.stubEnv("DATABASE_URL", runtimeUrl.toString())
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
        outcome: "partial",
      })
      const timeline = await owner.run.detail({ id: run.id })
      expect(timeline.map((event) => event.type)).toEqual([
        "started",
        "completed",
      ])
      expect(timeline[1].outcome).toBe("partial")
      expect(timeline[1].result).toEqual({ processed: 3 })
      const [storedRun] = await connection.db
        .select({ result: workflowRuns.result, outcome: workflowRuns.outcome })
        .from(workflowRuns)
        .where(eq(workflowRuns.id, run.id))
      expect(storedRun.outcome).toBe("partial")
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

    it("scopes immutable result declarations to authenticated project owners", async () => {
      const alice = await createOwner("Result definitions")
      const bob = await createOwner("Other results")
      const input = {
        projectId: alice.project.id,
        workflow: "integration.import",
        declaration: {
          revision: "v1",
          fields: [
            {
              path: ["processed"],
              label: "Imported",
              kind: "count" as const,
              unit: "rows",
            },
          ],
        },
      }
      const owner = caller(alice.cookie, alice.project.id)
      await expect(owner.resultDeclarations.create(input)).resolves.toEqual(
        input.declaration,
      )
      await expect(
        owner.resultDeclarations.create(input),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      expect(await owner.resultDeclarations.list(input)).toEqual([
        input.declaration,
      ])
      await expect(
        caller(bob.cookie).resultDeclarations.list(input),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      await expect(
        caller(bob.cookie).resultDeclarations.create({
          ...input,
          declaration: { ...input.declaration, revision: "v2" },
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      await expect(
        caller("").resultDeclarations.list(input),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      await expect(
        owner.resultDeclarations.create({
          ...input,
          declaration: {
            ...input.declaration,
            revision: "v2",
            fields: Array.from(
              { length: 13 },
              () => input.declaration.fields[0],
            ),
          },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })

    it("reuses a bounded auth pool and releases API pools across repeated request waves", async () => {
      const owner = await createOwner("Connection lifecycle")
      const read = caller(owner.cookie, owner.project.id)
      const connectionCount = async () => {
        const rows = await connection.db.execute<{ count: number }>(sql`
          select count(*)::int as count from pg_stat_activity
          where application_name = ${applicationName}
        `)
        return rows[0].count
      }
      const observations: number[] = []
      const observeAfterRequests = async () => {
        // Pool shutdown completes before runApi returns; allow the server's
        // activity view to observe disconnects before recording the plateau.
        await expect.poll(connectionCount).toBeLessThanOrEqual(10)
        const count = await connectionCount()
        expect(count).toBeGreaterThan(0) // The process-cached auth pool remains.
        observations.push(count)
      }
      await observeAfterRequests()
      for (let wave = 0; wave < 4; wave++) {
        await Promise.all(
          Array.from({ length: 6 }, async () => {
            const session = await authGet(
              new Request(`${origin}/api/auth/get-session`, {
                headers: { cookie: owner.cookie },
              }),
            )
            expect(session.status).toBe(200)
            expect((await session.json()).user.id).toBeTruthy()
            await sendRun(owner.writeKey.secret)
            expect(await read.project.list()).toEqual([
              expect.objectContaining({ id: owner.project.id }),
            ])
          }),
        )
        await observeAfterRequests()
      }
      const retainedAuthConnections = await connectionCount()
      // Ingestion uses project keys, so this wave cannot grow the auth pool.
      // Any extra retained connection would belong to a leaked API pool.
      await Promise.all(
        Array.from({ length: 6 }, () => sendRun(owner.writeKey.secret)),
      )
      await expect.poll(connectionCount).toBe(retainedAuthConnections)
      // A fresh API pool leaked per request would accumulate well beyond the
      // single cached postgres.js pool's default maximum of ten connections.
      expect(observations).toHaveLength(5)
      console.info(
        "Connection lifecycle: baseline and four completed waves",
        observations,
      )
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
