import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { Array, Deferred, Effect, Exit, Ref } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  user,
  account,
  session,
  verification,
  projects,
  projectMembers,
  projectApiKeys,
  accountLifecycleOperations,
  oauthClient,
  oauthResource,
  oauthClientResource,
  oauthRefreshToken,
  oauthAccessToken,
  oauthConsent,
  agentAccessGrantProjects,
  agentAccessOauthConsentIntents,
  agentAccessConnectionLastAuth,
  workflowDefinitionImports,
} from "@flowmark/db"
import {
  createOwnedProject,
  Database,
  renewCleanupCapability,
} from "@flowmark/db/persistence"
import { createFlowmarkAuth } from "@flowmark/auth"
import { Email, makeEmailCapture } from "@flowmark/email"
import { appRouter } from "../../src/adapters/trpc/router"
import { getAuth } from "../../src/auth"
import { IngestWorkflowEvents, runApi } from "@flowmark/api"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"

const origin = "http://localhost:3001"
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "coordinated account erasure",
  () => {
    let connection: ReturnType<typeof createDatabase>
    const run = <A, E>(effect: Effect.Effect<A, E, never>) =>
      Effect.runPromise(effect)
    const fixture = () => run(createDefinitionImportFixture(connection.db))
    type Fixture = Awaited<ReturnType<typeof fixture>>
    const caller = (cookie = "") =>
      appRouter.createCaller({
        request: new Request(`${origin}/api/trpc`, {
          headers: { origin, cookie },
        }),
      })
    const post = (path: string, body: unknown, cookie = "") =>
      new Request(`${origin}/api/auth${path}`, {
        method: "POST",
        headers: { origin, "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      })
    const confirm = (value: Fixture, operationId: string) =>
      caller(value.cookie).accountLifecycle.confirm({
        operationId,
        confirmation: "DELETE MY ACCOUNT",
        password: value.password,
      })
    const drain = (operationId: string, capability: string) =>
      run(
        Effect.gen(function* () {
          const current = yield* Ref.make<{ readonly state: string } | null>(
            null,
          )
          yield* Effect.forEach(
            Array.range(0, 200),
            () =>
              Effect.gen(function* () {
                if ((yield* Ref.get(current))?.state === "live_data_deleted") {
                  return
                }
                const next = yield* Effect.promise(() =>
                  caller().accountLifecycle.resume({ operationId, capability }),
                )
                yield* Ref.set(current, next)
              }),
            { discard: true },
          )
          return yield* Ref.get(current)
        }),
      )
    beforeAll(() => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("BETTER_AUTH_SECRET", `${randomUUID()}${randomUUID()}`)
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    afterAll(async () => {
      await connection.close()
      vi.unstubAllEnvs()
    })

    it("locks normal access and drains projects/auth records through scoped capability batches", async () => {
      const value = await fixture()
      const auth = await run(getAuth())
      const preview = await caller(value.cookie).accountLifecycle.preview()
      expect(preview.operation.counts.projects).toBe(1)
      await expect(
        caller(value.cookie).accountLifecycle.confirm({
          operationId: preview.operation.id,
          confirmation: "DELETE MY ACCOUNT",
          password: "wrong password",
        }),
      ).rejects.toThrow()
      await confirm(value, preview.operation.id)
      await expect(caller(value.cookie).project.list()).rejects.toThrow()
      await expect(
        caller(value.cookie).project.create({ name: "Late project" }),
      ).rejects.toThrow()
      await expect(
        run(
          createOwnedProject(value.userId, {
            workspace: "Late account workspace",
            project: "Late account project",
          }).pipe(Effect.provideService(Database, connection.db)),
        ),
      ).rejects.toThrow()
      await expect(
        caller().accountLifecycle.status({
          operationId: preview.operation.id,
          capability: "x".repeat(43),
        }),
      ).rejects.toThrow()
      expect(
        (
          await auth.handler(
            new Request(`${origin}/api/auth/get-session`, {
              headers: { cookie: value.cookie },
            }),
          )
        ).status,
      ).toBe(401)
      const status = await caller().accountLifecycle.status({
        operationId: preview.operation.id,
        capability: preview.capability,
      })
      expect(status.state).toBe("purging")
      expect(status.counts.previewProjects).toEqual([])
      const capabilityCaller = appRouter.createCaller({
        request: new Request(`${origin}/api/trpc`, {
          headers: {
            origin,
            authorization: `Bearer ${preview.capability}`,
            "x-flowmark-project-id": value.projectId,
          },
        }),
      })
      await expect(capabilityCaller.project.snapshot()).rejects.toThrow()
      await expect(
        capabilityCaller.project.create({
          name: "Capability cannot create projects",
        }),
      ).rejects.toThrow()
      expect(
        (await drain(preview.operation.id, preview.capability))?.state,
      ).toBe("live_data_deleted")
      expect(
        await connection.db
          .select()
          .from(user)
          .where(eq(user.id, value.userId)),
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(account)
          .where(eq(account.userId, value.userId)),
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(session)
          .where(eq(session.userId, value.userId)),
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(projects)
          .where(eq(projects.id, value.projectId)),
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(projectApiKeys)
          .where(eq(projectApiKeys.projectId, value.projectId)),
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(projects)
          .where(eq(projects.id, value.foreignProjectId)),
      ).toHaveLength(1)
      expect(
        (
          await caller().accountLifecycle.resume({
            operationId: preview.operation.id,
            capability: preview.capability,
          })
        ).state,
      ).toBe("live_data_deleted")
    }, 20000)

    it("blocks unexpected shared ownership without changing either identity", async () => {
      const value = await fixture()
      const [foreign] = await connection.db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, value.foreignProjectId))
      await connection.db.insert(projectMembers).values({
        userId: foreign.userId,
        projectId: value.projectId,
        role: "owner",
      })
      await expect(
        caller(value.cookie).accountLifecycle.preview(),
      ).rejects.toThrow("shared ownership")
      const [identity] = await connection.db
        .select()
        .from(user)
        .where(eq(user.id, value.userId))
      expect(identity.lifecycleOperationId).toBeNull()
    })

    it("drains large OAuth child populations and preserves another user's project and service client", async () => {
      const value = await fixture()
      const [foreign] = await connection.db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, value.foreignProjectId))
      const [ownedProject] = await connection.db
        .select()
        .from(projects)
        .where(eq(projects.id, value.projectId))
      await connection.db
        .update(projects)
        .set({ workspaceId: ownedProject.workspaceId })
        .where(eq(projects.id, value.foreignProjectId))
      const ownedClient = randomUUID()
      const serviceClient = randomUUID()
      const resource = `https://synthetic.example/${randomUUID()}`
      await connection.db.insert(oauthClient).values([
        {
          id: randomUUID(),
          clientId: ownedClient,
          userId: value.userId,
          redirectUris: [`${origin}/callback`],
        },
        {
          id: randomUUID(),
          clientId: serviceClient,
          redirectUris: [`${origin}/callback`],
        },
      ])
      await connection.db.insert(oauthResource).values({
        id: randomUUID(),
        identifier: resource,
        name: "Synthetic resource",
      })
      await connection.db.insert(oauthClientResource).values({
        id: randomUUID(),
        clientId: ownedClient,
        resourceId: resource,
      })
      const ownedFamily = randomUUID()
      const foreignFamily = randomUUID()
      const refreshId = randomUUID()
      await connection.db.insert(oauthRefreshToken).values([
        {
          id: refreshId,
          token: randomUUID(),
          clientId: ownedClient,
          userId: foreign.userId,
          authorizationCodeId: ownedFamily,
          scopes: ["flowmark:read"],
        },
        {
          id: randomUUID(),
          token: randomUUID(),
          clientId: serviceClient,
          userId: foreign.userId,
          authorizationCodeId: foreignFamily,
          scopes: ["flowmark:read"],
        },
      ])
      await connection.db.insert(oauthAccessToken).values(
        Array.map(Array.range(0, 120), () => ({
          id: randomUUID(),
          token: randomUUID(),
          clientId: ownedClient,
          userId: foreign.userId,
          refreshId,
          scopes: ["flowmark:read"],
        })),
      )
      const consentId = randomUUID()
      await connection.db.insert(oauthConsent).values({
        id: consentId,
        clientId: ownedClient,
        userId: foreign.userId,
        scopes: ["flowmark:read"],
      })
      await connection.db.insert(agentAccessOauthConsentIntents).values({
        userId: foreign.userId,
        clientId: ownedClient,
        oauthConsentId: consentId,
        authorizationCodeId: ownedFamily,
        resourceUrl: resource,
      })
      await connection.db.insert(agentAccessConnectionLastAuth).values({
        authorizationCodeId: ownedFamily,
        userId: foreign.userId,
        clientId: ownedClient,
      })
      await connection.db.insert(agentAccessGrantProjects).values([
        { authorizationCodeId: ownedFamily, projectId: value.foreignProjectId },
        {
          authorizationCodeId: foreignFamily,
          projectId: value.foreignProjectId,
        },
      ])
      const preview = await caller(value.cookie).accountLifecycle.preview()
      expect(preview.operation.counts.oauthClients).toBe(1)
      expect(preview.operation.counts.delegatedGrants).toBe(1)
      await confirm(value, preview.operation.id)
      await expect(
        connection.db
          .update(oauthClient)
          .set({ userId: foreign.userId })
          .where(eq(oauthClient.clientId, ownedClient)),
      ).rejects.toThrow()
      expect(
        (await drain(preview.operation.id, preview.capability))?.state,
      ).toBe("live_data_deleted")
      expect(
        await connection.db
          .select()
          .from(oauthClient)
          .where(eq(oauthClient.clientId, ownedClient)),
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(oauthClient)
          .where(eq(oauthClient.clientId, serviceClient)),
      ).toHaveLength(1)
      expect(
        await connection.db
          .select()
          .from(oauthAccessToken)
          .where(eq(oauthAccessToken.clientId, ownedClient)),
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(oauthRefreshToken)
          .where(eq(oauthRefreshToken.clientId, ownedClient)),
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(agentAccessGrantProjects)
          .where(eq(agentAccessGrantProjects.authorizationCodeId, ownedFamily)),
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(agentAccessGrantProjects)
          .where(
            eq(agentAccessGrantProjects.authorizationCodeId, foreignFamily),
          ),
      ).toHaveLength(1)
      expect(
        await connection.db
          .select()
          .from(projects)
          .where(eq(projects.id, value.foreignProjectId)),
      ).toHaveLength(1)
      expect(
        await connection.db
          .select()
          .from(oauthResource)
          .where(eq(oauthResource.identifier, resource)),
      ).toHaveLength(1)
    }, 20000)

    it("fences a previously authenticated ingestion request before any child purge begins", async () => {
      const value = await fixture()
      const ready = await run(Deferred.make<void>())
      const release = await run(Deferred.make<void>())
      const pending = runApi(
        Effect.flatMap(IngestWorkflowEvents, (ingest) =>
          ingest.ingest(
            `Bearer ${value.writeKey}`,
            Effect.gen(function* () {
              yield* Deferred.succeed(ready, undefined)
              yield* Deferred.await(release)
              return {
                eventId: randomUUID(),
                event: {
                  type: "started",
                  workflow: "late.account.test",
                  runId: randomUUID(),
                  timestamp: new Date().toISOString(),
                },
              }
            }),
          ),
        ),
      )
      await run(Deferred.await(ready))
      const preview = await caller(value.cookie).accountLifecycle.preview()
      try {
        await confirm(value, preview.operation.id)
      } finally {
        await run(Deferred.succeed(release, undefined))
      }
      expect(Exit.isFailure(await pending)).toBe(true)
      expect(
        await connection.db
          .select()
          .from(projectApiKeys)
          .where(eq(projectApiKeys.projectId, value.projectId)),
      ).not.toEqual([])
      expect(
        (await drain(preview.operation.id, preview.capability))?.state,
      ).toBe("live_data_deleted")
    }, 15000)

    it("cancels an unused account preview without locking or deleting resources", async () => {
      const value = await fixture()
      const stale = await caller(value.cookie).accountLifecycle.preview()
      const [key] = await connection.db
        .select()
        .from(projectApiKeys)
        .where(eq(projectApiKeys.projectId, value.projectId))
      await connection.db
        .update(projectApiKeys)
        .set({ name: "Rotated review metadata" })
        .where(eq(projectApiKeys.id, key.id))
      await expect(confirm(value, stale.operation.id)).rejects.toThrow(
        "preview expired or changed",
      )
      const preview = await caller(value.cookie).accountLifecycle.preview()
      await expect(
        caller().accountLifecycle.status({
          operationId: preview.operation.id,
          capability: preview.capability,
        }),
      ).rejects.toThrow()
      expect(
        (
          await caller(value.cookie).accountLifecycle.cancel({
            operationId: preview.operation.id,
          })
        ).state,
      ).toBe("cancelled")
      await expect(confirm(value, preview.operation.id)).rejects.toThrow(
        "preview expired or changed",
      )
      const [identity] = await connection.db
        .select()
        .from(user)
        .where(eq(user.id, value.userId))
      expect(identity.lifecycleOperationId).toBeNull()
      expect(await caller(value.cookie).project.list()).toHaveLength(1)
    })

    it("revokes owned grants and anonymizes actor references in another fenced project", async () => {
      const value = await fixture()
      const other = await fixture()
      const [receipt] = await connection.db
        .insert(workflowDefinitionImports)
        .values({
          projectId: other.projectId,
          actorId: value.userId,
          workflow: "historic.definition",
          source: "synthetic-app",
          manifestFingerprint: "synthetic-manifest",
          baseFingerprint: "synthetic-base",
          addedSearchKeys: [],
        })
        .returning()
      const clientId = randomUUID()
      const family = randomUUID()
      await connection.db.insert(oauthClient).values({
        id: randomUUID(),
        clientId,
        userId: value.userId,
        redirectUris: [`${origin}/callback`],
      })
      await connection.db.insert(oauthRefreshToken).values({
        id: randomUUID(),
        token: randomUUID(),
        clientId,
        userId: other.userId,
        authorizationCodeId: family,
        scopes: ["flowmark:read"],
      })
      await connection.db.insert(agentAccessGrantProjects).values({
        authorizationCodeId: family,
        projectId: other.projectId,
      })
      const otherPreview = await caller(other.cookie).accountLifecycle.preview()
      await confirm(other, otherPreview.operation.id)
      const preview = await caller(value.cookie).accountLifecycle.preview()
      await confirm(value, preview.operation.id)
      expect(
        (await drain(preview.operation.id, preview.capability))?.state,
      ).toBe("live_data_deleted")
      expect(
        await connection.db
          .select()
          .from(agentAccessGrantProjects)
          .where(eq(agentAccessGrantProjects.authorizationCodeId, family)),
      ).toEqual([])
      const [remaining] = await connection.db
        .select()
        .from(workflowDefinitionImports)
        .where(eq(workflowDefinitionImports.id, receipt.id))
      expect(remaining).toMatchObject({
        actorId: null,
        projectId: other.projectId,
        workflow: receipt.workflow,
        source: receipt.source,
        manifestFingerprint: receipt.manifestFingerprint,
      })
      expect(
        (await drain(otherPreview.operation.id, otherPreview.capability))
          ?.state,
      ).toBe("live_data_deleted")
    }, 25000)

    it("rejects native provider deletion through HTTP, callback and server API entry points", async () => {
      const value = await fixture()
      const auth = await run(getAuth())
      expect(
        (
          await auth.handler(
            post("/delete-user", { password: value.password }, value.cookie),
          )
        ).status,
      ).toBe(403)
      expect(
        (
          await auth.handler(
            new Request(
              `${origin}/api/auth/delete-user/callback?token=synthetic`,
              { headers: { cookie: value.cookie } },
            ),
          )
        ).status,
      ).toBe(403)
      await expect(
        auth.api.deleteUser({
          headers: { cookie: value.cookie },
          body: { password: value.password },
        }),
      ).rejects.toThrow("coordinated")
      expect(
        await connection.db
          .select()
          .from(user)
          .where(eq(user.id, value.userId)),
      ).toHaveLength(1)
    })

    it("deletes an empty account and rejects expired or foreign cleanup capabilities", async () => {
      const value = await fixture()
      // Use another ordinary provider identity, without provisioning a project.
      const auth = await run(getAuth())
      const signup = await auth.handler(
        post("/sign-up/email", {
          name: "Empty cleanup",
          email: `${randomUUID()}@example.test`,
          password: value.password,
        }),
      )
      const cookie = signup.headers
        .getSetCookie()
        .map((entry) => entry.split(";")[0])
        .join("; ")
      const preview = await caller(cookie).accountLifecycle.preview()
      expect(preview.operation.counts.projects).toBe(0)
      await caller(cookie).accountLifecycle.confirm({
        operationId: preview.operation.id,
        confirmation: "DELETE MY ACCOUNT",
        password: value.password,
      })
      await expect(
        caller().accountLifecycle.resume({
          operationId: randomUUID(),
          capability: preview.capability,
        }),
      ).rejects.toThrow()
      const first = await caller().accountLifecycle.resume({
        operationId: preview.operation.id,
        capability: preview.capability,
      })
      expect(first.state).toBe("purging")
      await connection.db
        .update(accountLifecycleOperations)
        .set({ contractVersion: 2 })
        .where(eq(accountLifecycleOperations.id, preview.operation.id))
      await expect(
        caller().accountLifecycle.status({
          operationId: preview.operation.id,
          capability: preview.capability,
        }),
      ).rejects.toThrow("compatible server version")
      await connection.db
        .update(accountLifecycleOperations)
        .set({ contractVersion: 1 })
        .where(eq(accountLifecycleOperations.id, preview.operation.id))
      await connection.db
        .update(accountLifecycleOperations)
        .set({ capabilityExpiresAt: new Date(0) })
        .where(eq(accountLifecycleOperations.id, preview.operation.id))
      await expect(
        caller().accountLifecycle.resume({
          operationId: preview.operation.id,
          capability: preview.capability,
        }),
      ).rejects.toThrow("Cleanup recovery code was not accepted or has expired")
      const [record] = await connection.db
        .select()
        .from(accountLifecycleOperations)
        .where(eq(accountLifecycleOperations.id, preview.operation.id))
      await expect(
        run(
          renewCleanupCapability(preview.operation.id, value.userId).pipe(
            Effect.provideService(Database, connection.db),
          ),
        ),
      ).rejects.toThrow()
      const renewed = await run(
        renewCleanupCapability(preview.operation.id, record.userId).pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      await expect(
        caller().accountLifecycle.status({
          operationId: preview.operation.id,
          capability: preview.capability,
        }),
      ).rejects.toThrow()
      expect(
        (await drain(renewed.operationId, renewed.capability))?.state,
      ).toBe("live_data_deleted")
    }, 15000)

    it("invalidates old recovery/verification evidence across same-email re-registration", async () => {
      const value = await fixture()
      const [identity] = await connection.db
        .select()
        .from(user)
        .where(eq(user.id, value.userId))
      const capture = await run(makeEmailCapture(origin, "local"))
      const delivery = await run(Email.pipe(Effect.provide(capture.layer)))
      const auth = createFlowmarkAuth({
        db: connection.db,
        secret: process.env.BETTER_AUTH_SECRET!,
        baseURL: origin,
        trustedOrigins: [origin],
        emailDelivery: delivery,
      })
      expect(
        (
          await auth.handler(
            post("/request-password-reset", {
              email: identity.email,
              redirectTo: `${origin}/reset-password`,
            }),
          )
        ).status,
      ).toBe(200)
      expect(
        (
          await auth.handler(
            post(
              "/send-verification-email",
              { email: identity.email, callbackURL: `${origin}/settings` },
              value.cookie,
            ),
          )
        ).status,
      ).toBe(200)
      const messages = await run(capture.read)
      const reset = messages.find((message) =>
        message.subject.includes("Reset your"),
      )!
      const resetUrl = new URL(reset.text.match(/Reset password: (\S+)/)![1])
      const token = resetUrl.pathname.split("/").at(-1)!
      const verify = messages.find((message) =>
        message.subject.includes("Verify"),
      )!
      const verificationUrl = verify.text.match(
        /https?:\/\/\S+verify-email\?\S+/,
      )![0]
      const preview = await caller(value.cookie).accountLifecycle.preview()
      await confirm(value, preview.operation.id)
      expect(
        (await drain(preview.operation.id, preview.capability))?.state,
      ).toBe("live_data_deleted")
      const freshPassword = randomUUID()
      const signup = await auth.handler(
        post("/sign-up/email", {
          name: "Fresh identity",
          email: identity.email,
          password: freshPassword,
        }),
      )
      expect(signup.status).toBe(200)
      const fresh = await signup.json()
      expect(fresh.user.id).not.toBe(value.userId)
      expect(
        (
          await auth.handler(
            post("/reset-password", { token, newPassword: randomUUID() }),
          )
        ).status,
      ).toBe(400)
      const oldVerify = await auth.handler(new Request(verificationUrl))
      expect(oldVerify.status).toBe(302)
      expect(oldVerify.headers.get("location")).toContain("INVALID_TOKEN")
      const [row] = await connection.db
        .select()
        .from(user)
        .where(eq(user.id, fresh.user.id))
      expect(row.emailVerified).toBe(false)
      expect(
        await connection.db
          .select()
          .from(projectMembers)
          .where(eq(projectMembers.userId, fresh.user.id)),
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(verification)
          .where(eq(verification.value, value.userId)),
      ).toEqual([])
    }, 20000)
  },
)
