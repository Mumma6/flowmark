import { createHmac, randomUUID } from "node:crypto"
import { and, eq, sql } from "drizzle-orm"
import { Array, Effect, Ref, Redacted } from "effect"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import {
  createDatabase,
  projectInvitations,
  projectMembers,
  projects,
  user,
  oauthClient,
  oauthRefreshToken,
  agentAccessGrantProjects,
} from "@flowmark/db"
import {
  Database,
  ProjectCredentialsStore,
  ProjectSharingStore,
  WorkflowStore,
  ProjectReadSubject,
} from "@flowmark/db/persistence"
import { Email, makeEmailCapture } from "@flowmark/email"
import { PersistenceError } from "@flowmark/api"
import { getAuth, resetAuthCacheForTests } from "../../src/auth"
import { appRouter } from "../../src/adapters/trpc/router"
import * as boundary from "../../src/adapters/trpc/project-sharing-boundary"

const origin = "http://localhost:3001"
const secret = `sharing-tests-${randomUUID()}-${randomUUID()}`
const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
const post = (path: string, body: unknown, cookie = "") =>
  new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: { cookie, origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
const caller = (
  cookie: string,
  projectId?: string,
  source = origin,
  extra: Record<string, string> = {},
) =>
  appRouter.createCaller({
    request: new Request(`${origin}/api/trpc`, {
      headers: {
        cookie,
        origin: source,
        ...(projectId ? { "x-flowmark-project-id": projectId } : {}),
        ...extra,
      },
    }),
  })
const run = <A, E>(operation: Effect.Effect<A, E>) =>
  Effect.runPromise(operation)

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "explicit project sharing",
  () => {
    let connection: ReturnType<typeof createDatabase>
    beforeAll(() => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("BETTER_AUTH_SECRET", secret)
      resetAuthCacheForTests()
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    beforeEach(() => {
      // Each scenario owns a separate synthetic auth policy namespace.
      vi.stubEnv("BETTER_AUTH_SECRET", `${randomUUID()}${randomUUID()}`)
      resetAuthCacheForTests()
    })
    afterAll(async () => {
      await connection?.close()
      vi.restoreAllMocks()
      vi.unstubAllEnvs()
      resetAuthCacheForTests()
    })
    const register = async (verified = true, targetEmail?: string) => {
      const auth = await run(getAuth())
      const password = randomUUID()
      const email = targetEmail ?? `sharing-${randomUUID()}@example.test`
      const response = await auth.handler(
        post("/sign-up/email", { name: "Sharing colleague", email, password }),
      )
      expect(response.status).toBe(200)
      const profile = (await response.json()).user
      const cookie = cookieOf(response)
      if (verified) {
        await connection.db
          .update(user)
          .set({ emailVerified: true })
          .where(eq(user.id, profile.id))
      }
      const actor = await auth.api.getSession({
        headers: { cookie },
        query: { disableCookieCache: true },
      })
      expect(actor).not.toBeNull()
      return {
        userId: profile.id as string,
        sessionId: actor!.session.id,
        email,
        password,
        cookie,
      }
    }
    type Actor = Awaited<ReturnType<typeof register>>
    const fixture = async () => {
      const capture = await run(makeEmailCapture(origin, "local"))
      const email = await run(Email.pipe(Effect.provide(capture.layer)))
      const failed = await run(Ref.make(false))
      vi.spyOn(boundary, "sharingNotifications").mockReturnValue({
        recipientKey: (address) =>
          Effect.succeed(
            createHmac("sha256", secret).update(address).digest("hex"),
          ),
        send: (message, token) =>
          Effect.gen(function* () {
            if (yield* Ref.get(failed)) {
              return yield* new PersistenceError({
                operation: "project-sharing-mail",
                cause: "Synthetic submission failure",
              })
            }
            yield* email
              .send({
                kind: "project-invitation",
                messageId: message.id,
                to: message.email,
                projectName: message.projectName,
                inviterName: message.inviterName,
                actionUrl: `${origin}/invitations/${message.id}?token=${Redacted.value(token)}`,
              })
              .pipe(
                Effect.mapError(
                  (cause) =>
                    new PersistenceError({
                      operation: "project-sharing-mail",
                      cause,
                    }),
                ),
              )
          }),
      })
      const owner = await register()
      const viewer = await register()
      const stranger = await register()
      const created = await caller(owner.cookie).project.create({
        name: "Shared diagnostic project",
      })
      const sibling = await caller(owner.cookie).project.create({
        name: "Private sibling project",
      })
      const projectId = created.project.id
      const invite = (
        address = viewer.email,
        password: string = owner.password,
        currentSessionId = owner.sessionId,
      ) =>
        caller(owner.cookie).projectSharing.invite({
          projectId,
          email: address,
          password,
          currentSessionId,
        })
      const latest = async () => {
        const messages = await run(capture.read)
        const message = messages.at(-1)
        expect(message).toBeDefined()
        const url = new URL(
          message!.text.match(/Review project invitation: (\S+)/)![1],
        )
        return {
          id: url.pathname.split("/").at(-1)!,
          token: url.searchParams.get("token")!,
        }
      }
      const review = (
        actor: Actor,
        proof: { id: string; token: string },
        action: "review" | "accept" | "decline" = "review",
      ) =>
        caller(actor.cookie).projectSharing.review({
          ...proof,
          action,
          currentSessionId: actor.sessionId,
        })
      return {
        owner,
        viewer,
        stranger,
        projectId,
        siblingId: sibling.project.id,
        writeKey: created.writeKey.secret,
        capture,
        failed,
        invite,
        latest,
        review,
      }
    }

    it("accepts a captured-mail invitation once and grants diagnostic reads only to the selected project", async () => {
      const f = await fixture()
      await f.invite()
      const proof = await f.latest()
      const pending = await caller(f.owner.cookie).projectSharing.list({
        projectId: f.projectId,
      })
      expect(pending.invitations).toHaveLength(1)
      expect(JSON.stringify(pending).includes(proof.token)).toBe(false)
      await expect(
        caller(f.viewer.cookie, f.projectId).project.snapshot(),
      ).rejects.toThrow()
      expect(await f.review(f.viewer, proof)).toMatchObject({
        projectId: f.projectId,
        role: "viewer",
        action: "review",
      })
      await f.review(f.viewer, proof, "accept")
      expect(
        (await caller(f.viewer.cookie).project.list()).map(
          (project) => project.id,
        ),
      ).toEqual([f.projectId])
      expect((await caller(f.viewer.cookie).project.list())[0].role).toBe(
        "viewer",
      )
      expect(
        await caller(f.viewer.cookie, f.projectId).project.snapshot(),
      ).toBeDefined()
      await expect(
        caller(f.viewer.cookie, f.siblingId).project.snapshot(),
      ).rejects.toThrow()
      await expect(
        caller(f.stranger.cookie, f.projectId).project.snapshot(),
      ).rejects.toThrow()
      await expect(f.review(f.viewer, proof, "accept")).rejects.toThrow()
      const details = await caller(f.viewer.cookie).projectSharing.list({
        projectId: f.projectId,
      })
      expect(details.members).toEqual([])
      expect(details.invitations).toEqual([])
      expect(JSON.stringify(details).includes(f.owner.email)).toBe(false)
      expect(
        (await caller(f.viewer.cookie).onboarding.state()).sharedAccess,
      ).toBe(true)
    })

    it("denies viewer management, key metadata, declarations, imports, deletion and roster access directly", async () => {
      const f = await fixture()
      await f.invite()
      await f.review(f.viewer, await f.latest(), "accept")
      const api = caller(f.viewer.cookie)
      const denied = [
        () => api.project.rename({ projectId: f.projectId, name: "Stolen" }),
        () => api.project.keys(f.projectId),
        () =>
          api.project.createWriteKey({
            projectId: f.projectId,
            name: "Stolen",
          }),
        () =>
          api.project.createReadKey({ projectId: f.projectId, name: "Stolen" }),
        () =>
          api.resultDeclarations.setSearchFields({
            projectId: f.projectId,
            workflow: "booking",
            fields: [],
          }),
        () =>
          api.resultDeclarations.previewImport({
            projectId: f.projectId,
            definition: {},
          }),
        () =>
          api.dataLifecycle.preview({
            projectId: f.projectId,
            scope: { kind: "project" },
          }),
        () =>
          api.projectSharing.invite({
            projectId: f.projectId,
            currentSessionId: f.viewer.sessionId,
            email: f.stranger.email,
            password: f.viewer.password,
          }),
        () =>
          api.projectSharing.remove({
            projectId: f.projectId,
            userId: f.owner.userId,
          }),
      ]
      await run(
        Effect.forEach(
          denied,
          (operation) =>
            Effect.promise(async () => {
              await expect(operation()).rejects.toThrow()
            }),
          { discard: true },
        ),
      )
      const store = await run(
        ProjectCredentialsStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      await expect(
        run(
          store.createApiKey(f.viewer.userId, f.projectId, {
            name: "Bypass",
            permission: "read",
          }),
        ),
      ).rejects.toThrow()
      expect(
        (
          await caller(f.owner.cookie).projectSharing.list({
            projectId: f.projectId,
          })
        ).projectName,
      ).toBe("Shared diagnostic project")
      expect(
        await api.resultDeclarations.list({
          projectId: f.projectId,
          workflow: "booking",
        }),
      ).toEqual([])
    })

    it("requires a verified matching identity, exact session, password, trusted origin and session-only credentials", async () => {
      const f = await fixture()
      await f.invite()
      const proof = await f.latest()
      await expect(f.review(f.stranger, proof)).rejects.toThrow()
      await connection.db
        .update(user)
        .set({ emailVerified: false })
        .where(eq(user.id, f.viewer.userId))
      await expect(f.review(f.viewer, proof)).rejects.toThrow()
      await connection.db
        .update(user)
        .set({ emailVerified: true })
        .where(eq(user.id, f.viewer.userId))
      await expect(
        f.invite(f.stranger.email, "incorrect-password"),
      ).rejects.toThrow()
      await expect(
        f.invite(f.stranger.email, f.owner.password, "stale-session"),
      ).rejects.toThrow()
      await expect(
        caller(
          f.owner.cookie,
          undefined,
          "https://evil.example",
        ).projectSharing.invite({
          projectId: f.projectId,
          email: f.stranger.email,
          password: f.owner.password,
          currentSessionId: f.owner.sessionId,
        }),
      ).rejects.toThrow()
      await expect(
        caller(f.owner.cookie, undefined, origin, {
          authorization: "Bearer forged",
        }).projectSharing.invite({
          projectId: f.projectId,
          email: f.stranger.email,
          password: f.owner.password,
          currentSessionId: f.owner.sessionId,
        }),
      ).rejects.toThrow()
      await expect(
        caller(f.viewer.cookie).projectSharing.review({
          ...proof,
          action: "accept",
          currentSessionId: "stale",
        }),
      ).rejects.toThrow()
      const mixed = caller(f.owner.cookie, undefined, origin, {
        authorization: "Bearer forged",
      })
      await expect(
        mixed.projectSharing.list({ projectId: f.projectId }),
      ).rejects.toThrow()
      await expect(
        mixed.projectSharing.revoke({ projectId: f.projectId, id: proof.id }),
      ).rejects.toThrow()
      expect(await f.review(f.viewer, proof)).toMatchObject({
        action: "review",
      })
    })

    it("replaces, revokes, declines and expires links without granting access", async () => {
      const f = await fixture()
      await f.invite()
      const old = await f.latest()
      await f.invite()
      const fresh = await f.latest()
      await expect(f.review(f.viewer, old, "accept")).rejects.toThrow()
      await f.review(f.viewer, fresh, "decline")
      await expect(f.review(f.viewer, fresh, "accept")).rejects.toThrow()
      await f.invite()
      const revoked = await f.latest()
      await caller(f.owner.cookie).projectSharing.revoke({
        projectId: f.projectId,
        id: revoked.id,
      })
      await expect(f.review(f.viewer, revoked, "accept")).rejects.toThrow()
      // Recipient attempts are bounded; a different recipient gets an independent bucket.
      await f.invite(f.stranger.email)
      const expired = await f.latest()
      await connection.db
        .update(projectInvitations)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(projectInvitations.id, expired.id))
      await expect(f.review(f.stranger, expired, "accept")).rejects.toThrow()
      await expect(
        caller(f.viewer.cookie, f.projectId).project.snapshot(),
      ).rejects.toThrow()
    })

    it("serializes simultaneous acceptance and rejects owner loss or promotion in the database", async () => {
      const f = await fixture()
      await f.invite()
      const proof = await f.latest()
      const attempts = await Promise.allSettled([
        f.review(f.viewer, proof, "accept"),
        f.review(f.viewer, proof, "accept"),
      ])
      expect(
        attempts.filter((attempt) => attempt.status === "fulfilled"),
      ).toHaveLength(1)
      const members = await connection.db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, f.projectId))
      expect(members).toHaveLength(2)
      await expect(
        connection.db
          .delete(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, f.projectId),
              eq(projectMembers.userId, f.owner.userId),
            ),
          ),
      ).rejects.toThrow()
      await expect(
        connection.db
          .update(projectMembers)
          .set({ role: "owner" })
          .where(
            and(
              eq(projectMembers.projectId, f.projectId),
              eq(projectMembers.userId, f.viewer.userId),
            ),
          ),
      ).rejects.toThrow()
      await expect(
        connection.db.insert(projectMembers).values({
          projectId: f.projectId,
          userId: f.stranger.userId,
          role: "owner",
        }),
      ).rejects.toThrow()
    })

    it("removes viewer access and grant bindings, preserves siblings, and does not revive old grants on rejoin", async () => {
      const f = await fixture()
      await f.invite()
      await f.review(f.viewer, await f.latest(), "accept")
      const own = await caller(f.viewer.cookie).project.create({
        name: "Viewer's own project",
      })
      const clientId = randomUUID(),
        family = randomUUID()
      await connection.db.insert(oauthClient).values({
        id: randomUUID(),
        clientId,
        redirectUris: [`${origin}/callback`],
      })
      await connection.db.insert(oauthRefreshToken).values({
        id: randomUUID(),
        token: randomUUID(),
        userId: f.viewer.userId,
        clientId,
        authorizationCodeId: family,
        scopes: ["flowmark:read"],
      })
      await connection.db.insert(agentAccessGrantProjects).values([
        { authorizationCodeId: family, projectId: f.projectId },
        { authorizationCodeId: family, projectId: own.project.id },
      ])
      const credentials = await run(
        ProjectCredentialsStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      expect(
        await run(credentials.memberProject(f.viewer.userId, f.projectId)),
      ).toBe(f.projectId)
      await caller(f.owner.cookie).projectSharing.remove({
        projectId: f.projectId,
        userId: f.viewer.userId,
      })
      await expect(
        caller(f.viewer.cookie, f.projectId).project.snapshot(),
      ).rejects.toThrow()
      const store = await run(
        WorkflowStore.make.pipe(Effect.provideService(Database, connection.db)),
      )
      await expect(
        run(
          store.snapshot(f.projectId).pipe(
            Effect.provideService(ProjectReadSubject, {
              kind: "user",
              userId: f.viewer.userId,
            }),
          ),
        ),
      ).rejects.toThrow()
      expect(
        await connection.db
          .select()
          .from(agentAccessGrantProjects)
          .where(eq(agentAccessGrantProjects.authorizationCodeId, family)),
      ).toEqual([expect.objectContaining({ projectId: own.project.id })])
      const readGrant = (projectId: string) =>
        run(
          credentials.delegatedReaderProject({
            userId: f.viewer.userId,
            clientId,
            authorizationCodeId: family,
            projectId,
          }),
        )
      expect(await readGrant(own.project.id)).toBe(own.project.id)
      expect(await readGrant(f.projectId)).toBeUndefined()
      await f.invite()
      await f.review(f.viewer, await f.latest(), "accept")
      expect(await readGrant(f.projectId)).toBeUndefined()
      expect(await readGrant(own.project.id)).toBe(own.project.id)
      expect(
        await connection.db
          .select()
          .from(agentAccessGrantProjects)
          .where(
            and(
              eq(agentAccessGrantProjects.authorizationCodeId, family),
              eq(agentAccessGrantProjects.projectId, f.projectId),
            ),
          ),
      ).toEqual([])
      await caller(f.viewer.cookie).projectSharing.remove({
        projectId: f.projectId,
        userId: f.viewer.userId,
      })
      await expect(
        caller(f.viewer.cookie, f.projectId).project.snapshot(),
      ).rejects.toThrow()
    })

    it("uses a personal creation target after joining and preserves the owner project when the viewer deletes its account", async () => {
      const f = await fixture()
      await f.invite()
      await f.review(f.viewer, await f.latest(), "accept")
      const created = await caller(f.viewer.cookie).project.create({
        name: "Personal project",
      })
      const selected = await connection.db
        .select()
        .from(projects)
        .where(
          sql`${projects.id} IN (${f.projectId}::uuid, ${created.project.id}::uuid)`,
        )
      expect(selected[0].workspaceId === selected[1].workspaceId).toBe(false)
      await expect(
        caller(f.owner.cookie).accountLifecycle.preview(),
      ).rejects.toThrow("shared ownership")
      const preview = await caller(f.viewer.cookie).accountLifecycle.preview()
      expect(preview.operation.counts.projects).toBe(1)
      await caller(f.viewer.cookie).accountLifecycle.confirm({
        operationId: preview.operation.id,
        confirmation: "DELETE MY ACCOUNT",
        password: f.viewer.password,
      })
      // Owner reads/ingestion must not inherit the deleting viewer's fence.
      expect(
        await caller(f.owner.cookie, f.projectId).project.snapshot(),
      ).toBeDefined()
      await caller(f.owner.cookie).projectSharing.remove({
        projectId: f.projectId,
        userId: f.viewer.userId,
      })
      await run(
        Effect.forEach(
          Array.range(1, 80),
          () =>
            Effect.promise(async () => {
              const state = await caller("").accountLifecycle.status({
                operationId: preview.operation.id,
                capability: preview.capability,
              })
              if (state.state !== "live_data_deleted") {
                await caller("").accountLifecycle.resume({
                  operationId: preview.operation.id,
                  capability: preview.capability,
                })
              }
            }),
          { discard: true },
        ),
      )
      expect(
        await connection.db
          .select()
          .from(user)
          .where(eq(user.id, f.viewer.userId)),
      ).toHaveLength(0)
      expect(
        await connection.db
          .select()
          .from(projects)
          .where(eq(projects.id, f.projectId)),
      ).toHaveLength(1)
      expect(
        await caller(f.owner.cookie, f.projectId).project.snapshot(),
      ).toBeDefined()
    }, 30000)

    it("rolls back failed acceptance and invalidates deletion previews when a viewer joins", async () => {
      const f = await fixture()
      const deletion = await caller(f.owner.cookie).dataLifecycle.preview({
        projectId: f.projectId,
        scope: { kind: "project" },
      })
      await f.invite()
      const proof = await f.latest()
      const name = sql.identifier(
        `sharing_rollback_${randomUUID().replaceAll("-", "")}`,
      )
      await connection.db.execute(
        sql`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic invitation failure'; END $$`,
      )
      await connection.db.execute(
        sql`CREATE TRIGGER ${name} BEFORE UPDATE ON project_invitations FOR EACH ROW WHEN (OLD.id = '${sql.raw(proof.id)}'::uuid) EXECUTE FUNCTION ${name}()`,
      )
      try {
        await expect(f.review(f.viewer, proof, "accept")).rejects.toThrow()
        expect(
          await connection.db
            .select()
            .from(projectMembers)
            .where(
              sql`${projectMembers.projectId} = ${f.projectId}::uuid AND ${projectMembers.userId} = ${f.viewer.userId}`,
            ),
        ).toHaveLength(0)
      } finally {
        await connection.db.execute(
          sql`DROP TRIGGER ${name} ON project_invitations`,
        )
        await connection.db.execute(sql`DROP FUNCTION ${name}()`)
      }
      await f.review(f.viewer, proof, "accept")
      await expect(
        caller(f.owner.cookie).dataLifecycle.confirm({
          projectId: f.projectId,
          operationId: deletion.id,
          confirmation: "DELETE PROJECT",
          password: f.owner.password,
        }),
      ).rejects.toThrow()
    })

    it("enforces member capacity inside persistence", async () => {
      const f = await fixture()
      const members = Array.map(Array.range(1, 24), () => ({
        id: randomUUID(),
        name: "Synthetic viewer",
        email: `${randomUUID()}@example.test`,
      }))
      await connection.db.insert(user).values(members)
      await connection.db.insert(projectMembers).values(
        Array.map(members, (member) => ({
          userId: member.id,
          projectId: f.projectId,
          role: "viewer" as const,
        })),
      )
      const store = await run(
        ProjectSharingStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      await expect(
        run(
          store.invite(
            f.owner.userId,
            f.projectId,
            f.viewer.email,
            "a".repeat(64),
          ),
        ),
      ).rejects.toMatchObject({
        _tag: "SharingRejected",
        reason: "LimitReached",
      })
    })

    it("keeps submission failures pending, enforces budgets and supports a recipient that registers after invitation", async () => {
      const f = await fixture()
      await run(Ref.set(f.failed, true))
      await expect(f.invite()).rejects.toThrow("mail submission")
      expect(
        (
          await caller(f.owner.cookie).projectSharing.list({
            projectId: f.projectId,
          })
        ).invitations[0].delivery,
      ).toBe("failed")
      await expect(
        caller(f.viewer.cookie, f.projectId).project.snapshot(),
      ).rejects.toThrow()
      await run(Ref.set(f.failed, false))
      await f.invite()
      await f.invite()
      await expect(f.invite()).rejects.toThrow()
      const newEmail = `new-${randomUUID()}@example.test`
      await f.invite(newEmail)
      const proof = await f.latest()
      const registered = await register(true, newEmail)
      await f.review(registered, proof, "accept")
      expect(
        await caller(registered.cookie, f.projectId).project.snapshot(),
      ).toBeDefined()
    })
  },
)
