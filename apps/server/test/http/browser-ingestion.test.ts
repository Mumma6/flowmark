import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  projectApiKeys,
  projectBrowserKeys,
  projects,
  workspaces,
} from "@flowmark/db"
import {
  consumeBrowserQuota,
  Database,
  hashApiKey,
} from "@flowmark/db/persistence"
import { DEMO_BROWSER_KEY } from "@flowmark/db/demo"
import { POST, OPTIONS } from "../../app/v1/browser-events/route"
import { POST as serverIngestion } from "../../app/v1/events/route"
import { appRouter } from "../../src/adapters/trpc"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "direct browser ingestion",
  () => {
    const projectId = randomUUID()
    const workspaceId = randomUUID()
    const publicKey = `fm_browser_${randomUUID()}`
    const quotaKey = `fm_browser_${randomUUID()}`
    const writeKey = randomUUID()
    const readKey = randomUUID()
    const origin = "http://localhost:5173"
    const runId = randomUUID()
    let connection: ReturnType<typeof createDatabase>
    let quotaKeyId: string

    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      await connection.db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Browser tests" })
      await connection.db
        .insert(projects)
        .values({ id: projectId, workspaceId, name: "Browser project" })
      await connection.db.insert(projectApiKeys).values([
        { projectId, keyHash: hashApiKey(writeKey), permission: "write" },
        { projectId, keyHash: hashApiKey(readKey), permission: "read" },
      ])
      const rows = await connection.db
        .insert(projectBrowserKeys)
        .values([
          {
            projectId,
            keyHash: hashApiKey(publicKey),
            allowedOrigins: [origin],
          },
          {
            projectId,
            keyHash: hashApiKey(quotaKey),
            allowedOrigins: [origin],
          },
        ])
        .returning()
      quotaKeyId = rows[1].id
    })
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })
    const started = () => ({
      type: "started",
      workflow: "checkout",
      runId,
      timestamp: new Date().toISOString(),
    })
    const envelope = (
      event: unknown = started(),
      eventId: string = randomUUID(),
    ) => ({ eventId, event })
    const send = (
      body: unknown = envelope(),
      key: string = publicKey,
      from: string | null = origin,
    ) => {
      const headers = new Headers({
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      })
      if (from !== null) {
        headers.set("origin", from)
      }
      return POST(
        new Request("http://localhost/v1/browser-events", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
      )
    }
    const reader = (key: string = readKey) =>
      appRouter.createCaller({
        request: new Request("http://localhost/api/trpc", {
          headers: { authorization: `Bearer ${key}` },
        }),
      })

    it("allows preflight only for registered origins and never allows credentialed CORS", async () => {
      const allowed = await OPTIONS(
        new Request("http://localhost/v1/browser-events", {
          method: "OPTIONS",
          headers: {
            origin,
            "access-control-request-method": "POST",
            "access-control-request-headers":
              "authorization,b3,content-type,traceparent",
          },
        }),
      )
      expect(allowed.status).toBe(204)
      expect(allowed.headers.get("access-control-allow-origin")).toBe(origin)
      expect(allowed.headers.get("access-control-allow-credentials")).toBeNull()
      expect(
        allowed.headers.get("access-control-allow-headers")?.split(", "),
      ).toEqual(["content-type", "authorization", "traceparent", "b3"])
      const denied = await OPTIONS(
        new Request("http://localhost/v1/browser-events", {
          method: "OPTIONS",
          headers: {
            origin: "https://not-registered.example",
            "access-control-request-method": "POST",
          },
        }),
      )
      expect(denied.status).toBe(403)
      expect(denied.headers.get("access-control-allow-origin")).toBeNull()
    })

    it("rejects secret keys and unknown public keys at the browser endpoint", async () => {
      for (const key of [writeKey, readKey, "invalid"]) {
        expect((await send(envelope(), key)).status).toBe(401)
      }
    })

    it("does not accept browser keys for private writes or reads", async () => {
      const result = await serverIngestion(
        new Request("http://localhost/v1/events", {
          method: "POST",
          headers: { authorization: `Bearer ${publicKey}` },
          body: JSON.stringify(envelope()),
        }),
      )
      expect(result.status).toBe(401)
      await expect(reader(publicKey).project.snapshot()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
    })

    it.each([
      null,
      "http://localhost:5174",
      "http://localhost:5173.attacker.example",
    ])("rejects absent/nonmatching origins: %s", async (from) => {
      const result = await send(envelope(), publicKey, from)
      expect(result.status).toBe(403)
      expect(result.headers.get("access-control-allow-origin")).toBeNull()
    })

    it("validates envelopes and includes CORS on authorized input errors", async () => {
      const response = await send({ eventId: "invalid", event: started() })
      expect(response.status).toBe(400)
      expect(response.headers.get("access-control-allow-origin")).toBe(origin)
      expect(
        (
          await send(
            envelope({ ...started(), type: "step", step: "before-start" }),
          )
        ).status,
      ).toBe(409)
    })

    it("persists browser events idempotently in a separate workflow namespace", async () => {
      const body = envelope()
      expect((await send(body)).status).toBe(202)
      expect((await send(body)).status).toBe(202)
      const report = envelope({
        ...started(),
        type: "report",
        result: { imported: 20 },
      })
      expect((await send(report)).status).toBe(202)
      expect((await send(report)).status).toBe(202)
      expect(
        (
          await send(
            envelope({ ...started(), type: "completed", outcome: "partial" }),
          )
        ).status,
      ).toBe(202)
      const conflict = await send(
        envelope({
          ...started(),
          type: "failed",
          failure: { code: "LATE_FAILURE" },
        }),
      )
      expect(conflict.status).toBe(409)
      expect(conflict.headers.get("access-control-allow-origin")).toBe(origin)
      expect(await conflict.json()).toMatchObject({
        accepted: false,
        disposition: "conflict",
      })
      const snapshot = await reader().project.snapshot()
      expect(snapshot.runs).toHaveLength(1)
      expect(snapshot.runs[0]).toMatchObject({
        workflow: "browser.checkout",
        status: "Completed",
        outcome: "partial",
      })
      const timeline = await reader().run.detail({ id: snapshot.runs[0].id })
      expect(timeline).toHaveLength(3)
      expect(timeline.find((row) => row.isLatestReport)).toMatchObject({
        workflow: "browser.checkout",
        result: { imported: 20 },
      })
      expect(snapshot.runs[0].result).toBeNull()
    })

    it("enforces the exact shared limit atomically and resets after the window expires", async () => {
      const results = await Effect.runPromise(
        Effect.forEach(
          Array.from({ length: 125 }),
          () => consumeBrowserQuota(quotaKeyId),
          { concurrency: 20 },
        ).pipe(Effect.provideService(Database, connection.db)),
      )
      expect(results.filter(Boolean)).toHaveLength(120)
      const response = await send(envelope(), quotaKey)
      expect(response.status).toBe(429)
      expect(response.headers.get("retry-after")).toBe("60")
      expect(response.headers.get("access-control-allow-origin")).toBe(origin)
      await connection.db
        .update(projectBrowserKeys)
        .set({
          rateWindowStartedAt: new Date(Date.now() - 61000),
        })
        .where(
          and(
            eq(projectBrowserKeys.projectId, projectId),
            eq(projectBrowserKeys.id, quotaKeyId),
          ),
        )
      expect((await send(envelope(), quotaKey)).status).toBe(202)
    })

    it("rejects the public demo key when demo mode is disabled", async () => {
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      expect(
        (await send(envelope(), DEMO_BROWSER_KEY, "http://localhost:3004"))
          .status,
      ).toBe(401)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
    })
  },
)
