import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { createDatabase } from "../../src/client.js"
import { Database } from "../../src/persistence/database.js"
import { DeploymentStore } from "../../src/persistence/runtime-deployment/deployment-store.js"
import { RepositoryInstallationStore } from "../../src/persistence/repository-installations/repository-installation-store.js"
import {
  agentAccessGrantProjects,
  oauthClient,
  oauthRefreshToken,
  projectMembers,
  projects,
  user,
  workspaces,
} from "../../src/schema/index.js"

const url = process.env.TEST_DATABASE_URL

const policy = {
  allowedNamespaces: [
    { kind: "entity" as const, namespace: "booking" },
    { kind: "change" as const, namespace: "reschedule" },
  ],
  retentionDays: 30,
  maxEventBytes: 16_384,
  maxOverheadMs: 10,
  maxEventsPerMinute: 600,
  allowRawPayloads: false as const,
}

test(
  "repository installations deduplicate deliveries, reject stale and foreign events, and isolate revocation",
  { skip: !url },
  async () => {
    const client = createDatabase(url!)
    const { db } = client
    const workspaceId = randomUUID()
    const projectId = randomUUID()
    const owner = randomUUID()
    const foreignOwner = randomUUID()
    const clientId = `cursor-${randomUUID()}`
    const installGrantCode = `install-code-${randomUUID()}`
    const independentGrantCode = `independent-code-${randomUUID()}`

    try {
      await db.insert(user).values([
        { id: owner, name: "Owner", email: `${owner}@example.test` },
        {
          id: foreignOwner,
          name: "Foreign",
          email: `${foreignOwner}@example.test`,
        },
      ])
      await db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Install workspace" })
      await db
        .insert(projects)
        .values({ id: projectId, workspaceId, name: "Install project" })
      await db
        .insert(projectMembers)
        .values({ projectId, userId: owner, role: "owner" })
      await db.insert(oauthClient).values({
        id: randomUUID(),
        clientId,
        name: "Test MCP client",
        redirectUris: ["http://127.0.0.1:4321/callback"],
        public: true,
        userId: owner,
      })
      await db.insert(oauthRefreshToken).values([
        {
          id: randomUUID(),
          token: `tok-${randomUUID()}`,
          clientId,
          userId: owner,
          authorizationCodeId: installGrantCode,
          scopes: ["mcp:read"],
          expiresAt: new Date(Date.now() + 86_400_000),
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          token: `tok-${randomUUID()}`,
          clientId,
          userId: owner,
          authorizationCodeId: independentGrantCode,
          scopes: ["mcp:read"],
          expiresAt: new Date(Date.now() + 86_400_000),
          createdAt: new Date(),
        },
      ])
      await db.insert(agentAccessGrantProjects).values([
        { authorizationCodeId: installGrantCode, projectId },
        { authorizationCodeId: independentGrantCode, projectId },
      ])

      const deployments = await Effect.runPromise(
        DeploymentStore.make.pipe(Effect.provideService(Database, db)),
      )
      const installations = await Effect.runPromise(
        RepositoryInstallationStore.make.pipe(
          Effect.provideService(Database, db),
        ),
      )

      const binding = await Effect.runPromise(
        deployments.rotateBinding(
          owner,
          {
            projectId,
            repository: "example/bookings",
            service: "worker",
            environment: "production",
          },
          "secret-hash",
        ),
      )

      const created = await Effect.runPromise(
        installations.upsert(owner, {
          projectId,
          bindingId: binding.id,
          host: "github",
          runtime: "node",
          repository: "example/bookings",
          service: "worker",
          environment: "production",
          externalInstallationId: "gh-inst-1",
          policy,
          delegatedGrantFamily: {
            authorizationCodeId: installGrantCode,
            clientId,
          },
        }),
      )
      assert.equal(created.status, "pending-verification")
      assert.equal(created.coldStartStatus, "pending-deployment-receipt")

      await assert.rejects(
        Effect.runPromise(installations.list(foreignOwner, projectId)),
      )

      const accepted = await Effect.runPromise(
        installations.recordDelivery({
          host: "github",
          externalInstallationId: "gh-inst-1",
          repository: "example/bookings",
          deliveryId: "delivery-1",
          action: "created",
          sentAt: new Date("2026-11-23T10:00:00.000Z"),
          revoke: false,
        }),
      )
      assert.equal(accepted.status, "accepted")

      const duplicate = await Effect.runPromise(
        installations.recordDelivery({
          host: "github",
          externalInstallationId: "gh-inst-1",
          repository: "example/bookings",
          deliveryId: "delivery-1",
          action: "created",
          sentAt: new Date("2026-11-23T10:00:00.000Z"),
          revoke: false,
        }),
      )
      assert.equal(duplicate.status, "duplicate")

      const stale = await Effect.runPromise(
        installations.recordDelivery({
          host: "github",
          externalInstallationId: "gh-inst-1",
          repository: "example/bookings",
          deliveryId: "delivery-stale",
          action: "updated",
          sentAt: new Date("2026-11-23T09:59:00.000Z"),
          revoke: false,
        }),
      )
      assert.equal(stale.status, "stale")

      const foreignRepo = await Effect.runPromise(
        installations.recordDelivery({
          host: "github",
          externalInstallationId: "gh-inst-1",
          repository: "foreign/other",
          deliveryId: "delivery-foreign",
          action: "created",
          sentAt: new Date("2026-11-23T10:01:00.000Z"),
          revoke: false,
        }),
      )
      assert.equal(foreignRepo.status, "foreign-repository")

      const uninstalled = await Effect.runPromise(
        installations.recordDelivery({
          host: "github",
          externalInstallationId: "gh-inst-1",
          repository: "example/bookings",
          deliveryId: "delivery-uninstall",
          action: "deleted",
          sentAt: new Date("2026-11-23T10:02:00.000Z"),
          revoke: true,
        }),
      )
      assert.equal(uninstalled.status, "revoked-now")

      const afterRevoke = await Effect.runPromise(
        installations.recordDelivery({
          host: "github",
          externalInstallationId: "gh-inst-1",
          repository: "example/bookings",
          deliveryId: "delivery-after-revoke",
          action: "updated",
          sentAt: new Date("2026-11-23T10:03:00.000Z"),
          revoke: false,
        }),
      )
      assert.equal(afterRevoke.status, "revoked")

      const remainingGrants = await db
        .select()
        .from(agentAccessGrantProjects)
        .where(eq(agentAccessGrantProjects.projectId, projectId))
      assert.deepEqual(
        remainingGrants.map((row) => row.authorizationCodeId),
        [independentGrantCode],
      )
    } finally {
      await client.close()
    }
  },
)
