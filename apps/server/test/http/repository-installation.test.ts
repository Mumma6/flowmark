import { createHash, randomBytes, randomUUID } from "node:crypto"
import { Effect } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  deploymentBindings,
  projectApiKeys,
  projects,
  repositoryInstallations,
  workspaces,
} from "@flowmark/db"
import {
  createOwnedProject,
  Database,
  hashApiKey,
} from "@flowmark/db/persistence"
import {
  createFlowmark,
  createRuntimeObservationEmitter,
} from "../../../../packages/sdk/src/index.js"
import { POST as deployment } from "../../app/v1/deployments/route"
import { POST as ingest } from "../../app/v1/events/route"
import { POST as githubWebhook } from "../../app/v1/installations/github/route"
import { getAuth } from "../../src/auth"
import { appRouter } from "../../src/adapters/trpc/router"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "repository installation disposable readback and webhook boundary",
  () => {
    const projectId = randomUUID()
    const foreignProjectId = randomUUID()
    const workspaceId = randomUUID()
    const bindingId = randomUUID()
    const installationId = randomUUID()
    const writeKey = randomUUID()
    const readKey = randomUUID()
    const foreignReadKey = randomUUID()
    const referenceKey = randomUUID()
    const deploymentToken = `fmd_${randomBytes(32).toString("hex")}`
    const deploymentId = `bootstrap-${randomUUID()}`
    const artifactDigest = `sha256:${"a".repeat(64)}`
    const sourceRevision = "b".repeat(40)
    const repository = "example/bookings"
    const service = "worker"
    const environment = "staging"
    const probeId = "bootstrap.probe"

    const caller = (key: string) =>
      appRouter.createCaller({
        request: new Request("http://localhost/api/trpc", {
          headers: { authorization: `Bearer ${key}` },
        }),
      })

    let connection: ReturnType<typeof createDatabase>

    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      const { db } = connection
      await db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Install integration workspace" })
      await db.insert(projects).values([
        { id: projectId, workspaceId, name: "Install integration project" },
        { id: foreignProjectId, workspaceId, name: "Foreign project" },
      ])
      await db.insert(projectApiKeys).values([
        {
          projectId,
          name: "ingest",
          permission: "write",
          keyHash: hashApiKey(writeKey),
          keyPrefix: "write",
        },
        {
          projectId,
          name: "diagnostic-read",
          permission: "read",
          keyHash: hashApiKey(readKey),
          keyPrefix: "read",
        },
        {
          projectId: foreignProjectId,
          name: "foreign-read",
          permission: "read",
          keyHash: hashApiKey(foreignReadKey),
          keyPrefix: "foreign",
        },
      ])
      await db.insert(deploymentBindings).values({
        id: bindingId,
        projectId,
        repository,
        service,
        environment,
        secretHash: createHash("sha256").update(deploymentToken).digest("hex"),
      })
      await db.insert(repositoryInstallations).values({
        id: installationId,
        projectId,
        bindingId,
        host: "github",
        runtime: "node",
        repository,
        service,
        environment,
        externalInstallationId: `gh-${randomUUID().slice(0, 8)}`,
        policy: {
          allowedNamespaces: [
            { kind: "entity", namespace: "booking" },
            { kind: "change", namespace: "reschedule" },
          ],
          retentionDays: 30,
          maxEventBytes: 16_384,
          maxOverheadMs: 10,
          maxEventsPerMinute: 600,
          allowRawPayloads: false,
        },
        status: "pending-verification",
        coldStartStatus: "pending-deployment-receipt",
      })
      vi.stubGlobal("fetch", (url: RequestInfo | URL, init?: RequestInit) =>
        ingest(new Request(url, init)),
      )
    })

    afterAll(async () => {
      await connection?.close()
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    })

    it("verifies one permitted observation with separate deploy, write and read identities", async () => {
      // 1. Deployment attestation identity posts the artifact manifest
      const deployResponse = await deployment(
        new Request("http://localhost/v1/deployments", {
          method: "POST",
          headers: {
            authorization: `Bearer ${deploymentToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            bindingId,
            deploymentId,
            manifest: {
              version: 1,
              repository,
              artifactDigest,
              revision: sourceRevision,
              probes: [
                {
                  probeId,
                  behaviorId: "booking.reschedule",
                  behaviorRevision: "1",
                  location: {
                    kind: "source",
                    path: "src/bookings/reschedule.ts",
                    symbol: "applyReschedule",
                  },
                },
              ],
            },
          }),
        }),
      )
      expect(deployResponse.status).toBe(200)

      // 2. Ingestion write identity records one permitted observation via SDK
      const flowmark = createFlowmark({
        apiUrl: "http://localhost",
        apiKey: writeKey,
        environment,
      })
      const emitter = createRuntimeObservationEmitter({
        key: referenceKey,
        namespaces: [
          { kind: "entity", namespace: "booking" },
          { kind: "change", namespace: "reschedule" },
        ],
        probe: { bindingId, deploymentId, artifactDigest, probeId },
      })
      const flow = flowmark.workflow("booking.reschedule")
      emitter.observe(flow, {
        entity: { booking: "B-100" },
        change: { reschedule: "C-100" },
      })
      flow.done()
      await flowmark.shutdown()

      // 3. Separate diagnostic read identity resolves the persisted run and verifies readback
      const readApi = caller(readKey)
      const listed = await readApi.run.list({
        workflow: "booking.reschedule",
        externalId: flow.runId,
      })
      expect(listed.runs).toHaveLength(1)
      const runId = listed.runs[0]!.id

      // Foreign read identity is denied
      await expect(
        caller(foreignReadKey).repositoryInstallation.verifyDisposableReadback({
          projectId,
          installationId,
          runId,
          deploymentId,
          artifactDigest,
          probeId,
        }),
      ).rejects.toThrow()

      // Authorized diagnostic read verifies the installation and updates cold-start state
      const verified =
        await readApi.repositoryInstallation.verifyDisposableReadback({
          projectId,
          installationId,
          runId,
          deploymentId,
          artifactDigest,
          probeId,
        })
      expect(verified.installation.status).toBe("active")
      expect(verified.installation.coldStartStatus).toBe(
        "pending-eligible-traffic",
      )
      expect(verified.verifiedEventIds.length).toBeGreaterThan(0)
    })

    it("rejects unsigned webhook delivery requests at the HTTP boundary", async () => {
      const response = await githubWebhook(
        new Request("http://localhost/v1/installations/github", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deliveryId: "unsigned-1" }),
        }),
      )
      expect([401, 503]).toContain(response.status)
    })
  },
)

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "repository installation bootstrap preparation",
  () => {
    let connection: ReturnType<typeof createDatabase>
    const permissions = {
      contents: "write" as const,
      pullRequests: "write" as const,
      metadata: "read" as const,
    }
    const caller = (cookie?: string) =>
      appRouter.createCaller({
        request: new Request("http://localhost:3001/api/trpc", {
          headers: {
            origin: "http://localhost:3001",
            ...(cookie ? { cookie } : {}),
          },
        }),
      })

    beforeAll(() => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })

    afterAll(async () => {
      await connection.close()
      vi.unstubAllEnvs()
    })

    it("returns the file plan and stores no pull request when the host is unconfigured", async () => {
      const auth = await Effect.runPromise(getAuth())
      const context = await auth.$context
      const email = `install-${randomUUID()}@example.test`
      const password = `${randomUUID()}${randomUUID()}`
      const created = await context.internalAdapter.createUser(
        {
          email,
          name: "Install owner",
          emailVerified: true,
        },
        { method: "email-password" },
      )
      const hash = await context.password.hash(password)
      await context.internalAdapter.linkAccount({
        userId: created.id,
        providerId: "credential",
        accountId: created.id,
        password: hash,
      })
      const signedIn = await auth.handler(
        new Request("http://localhost:3001/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            origin: "http://localhost:3001",
            "content-type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }),
      )
      expect(signedIn.status).toBe(200)
      const cookie = signedIn.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ")
      const owned = await Effect.runPromise(
        createOwnedProject(created.id, {
          workspace: "Installation bootstrap",
          project: "Booking service",
        }).pipe(Effect.provideService(Database, connection.db)),
      )
      const api = caller(cookie)
      const connected = await api.repositoryInstallation.connect({
        projectId: owned.projectId,
        host: "github",
        runtime: "node",
        repository: "example/bookings",
        service: "worker",
        environment: "staging",
        externalInstallationId: "gh-local-1",
        policy: {
          allowedNamespaces: [
            { kind: "entity", namespace: "booking" },
            { kind: "change", namespace: "reschedule" },
          ],
          retentionDays: 30,
          maxEventBytes: 16_384,
          maxOverheadMs: 10,
          maxEventsPerMinute: 600,
          allowRawPayloads: false,
        },
      })
      expect(connected.deploymentToken.startsWith("fmd_")).toBe(true)
      const prepared = await api.repositoryInstallation.prepareBootstrapPr({
        projectId: owned.projectId,
        installationId: connected.installation.id,
        apiOrigin: "https://api.flowmark.test",
        permissions,
      })
      expect(prepared.status).toBe("pr-not-opened")
      if (prepared.status !== "pr-not-opened") {
        return
      }
      expect(prepared.installation.bootstrapPr).toBeNull()
      expect(prepared.plan.files.length).toBeGreaterThan(0)
      expect(
        prepared.plan.files
          .map((file) => file.content)
          .join("\n")
          .includes(connected.deploymentToken),
      ).toBe(false)

      await expect(
        caller().repositoryInstallation.prepareBootstrapPr({
          projectId: owned.projectId,
          installationId: connected.installation.id,
          apiOrigin: "https://api.flowmark.test",
          permissions,
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })

      await api.repositoryInstallation.revoke({
        projectId: owned.projectId,
        installationId: connected.installation.id,
      })
      await expect(
        api.repositoryInstallation.prepareBootstrapPr({
          projectId: owned.projectId,
          installationId: connected.installation.id,
          apiOrigin: "https://api.flowmark.test",
          permissions,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  },
)
