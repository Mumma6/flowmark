import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { and, eq, inArray } from "drizzle-orm"
import { Effect } from "effect"
import { createDatabase } from "../../src/client.js"
import type { FlowmarkDatabase } from "../../src/client.js"
import { Database } from "../../src/persistence/database.js"
import { AgentAccessConsentRejected } from "../../src/persistence/project-access/agent-access-errors.js"
import { getDelegatedReaderProject } from "../../src/persistence/project-access/queries/get-delegated-reader-project.js"
import { revokeAgentAccessConnection } from "../../src/persistence/project-access/writes/revoke-agent-access-connection.js"
import { submitAgentAccessConsent } from "../../src/persistence/project-access/writes/submit-agent-access-consent.js"
import { createOwnedProject } from "../../src/persistence/project-access/writes/create-owned-project.js"
import { user } from "../../src/schema/auth.js"
import {
  agentAccessGrantProjects,
  agentAccessOauthConsentIntents,
  oauthClient,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
  projectApiKeys,
  projectMembers,
  projects,
  workspaces,
} from "../../src/schema/index.js"

const url = process.env.TEST_DATABASE_URL

const run = (db: FlowmarkDatabase) => {
  return <A, E, R extends Database>(effect: Effect.Effect<A, E, R>) =>
    Effect.runPromise(effect.pipe(Effect.provideService(Database, db)))
}

test(
  "delegated grant reads intersect membership, reject non-members and stale rows, and survive concurrent consent",
  { skip: !url },
  async () => {
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url!).hostname),
      "disposable loopback TEST_DATABASE_URL required",
    )
    const { db, close } = createDatabase(url!)
    const exec = run(db)
    const userId = randomUUID()
    const otherUserId = randomUUID()
    const clientId = `test-client-${randomUUID()}`
    const resourceIdentifier = `https://integration.flowmark.test/mcp`
    const resourceUrl = resourceIdentifier
    const redirectUri = "http://127.0.0.1:9999/callback"
    const authorizationCodeId = randomUUID()
    const consentId = randomUUID()
    const oauthClientRowId = randomUUID()
    const oauthResourceRowId = randomUUID()
    const requestedScopes = [
      "openid",
      "offline_access",
      "flowmark:read",
    ] as const
    const createdProjectIds: string[] = []
    let workspaceIds: string[] = []

    const insertSyntheticGrantFamily = async () => {
      await db.insert(oauthClient).values({
        id: oauthClientRowId,
        clientId,
        name: "Integration delegated client",
        redirectUris: [redirectUri],
        grantTypes: ["authorization_code", "refresh_token"],
        responseTypes: ["code"],
        tokenEndpointAuthMethod: "none",
        applicationType: "native",
        requirePKCE: true,
        skipConsent: true,
        disabled: false,
        scopes: [...requestedScopes],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      await db.insert(oauthResource).values({
        id: oauthResourceRowId,
        identifier: resourceIdentifier,
        name: "MCP",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      await db.insert(oauthClientResource).values({
        id: randomUUID(),
        clientId,
        resourceId: resourceIdentifier,
        createdAt: new Date(),
      })
      await db.insert(oauthConsent).values({
        id: consentId,
        clientId,
        userId,
        resources: [resourceIdentifier],
        scopes: [...requestedScopes],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const refreshTokenId = randomUUID()
      const refreshTokenValue = randomUUID()
      await db.insert(oauthRefreshToken).values({
        id: refreshTokenId,
        token: refreshTokenValue,
        clientId,
        userId,
        authorizationCodeId,
        resources: [resourceIdentifier],
        scopes: [...requestedScopes],
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
      })
    }

    try {
      await db.insert(user).values({
        id: userId,
        name: "Delegated grant test",
        email: `${userId}@example.test`,
      })
      await db.insert(user).values({
        id: otherUserId,
        name: "Other user",
        email: `${otherUserId}@example.test`,
      })

      const ownedA = await exec(
        createOwnedProject(userId, {
          workspace: "W1",
          project: "Project A",
        }),
      )
      const ownedB = await exec(
        createOwnedProject(userId, {
          workspace: "W2",
          project: "Project B",
        }),
      )
      createdProjectIds.push(ownedA.projectId, ownedB.projectId)
      const wsRows = await db
        .select({ workspaceId: projects.workspaceId })
        .from(projects)
        .where(inArray(projects.id, [ownedA.projectId, ownedB.projectId]))
      workspaceIds = [...new Set(wsRows.map((r) => r.workspaceId))]

      await insertSyntheticGrantFamily()

      const consentInput = {
        userId,
        oauthConsentId: consentId,
        clientId,
        redirectUri,
        requestedScopes: [...requestedScopes],
        resourceUrl,
      } as const

      const firstBind = await exec(
        submitAgentAccessConsent({
          ...consentInput,
          projectIds: [ownedA.projectId],
        }),
      )
      assert.equal(firstBind, authorizationCodeId)

      const allowedA = await exec(
        getDelegatedReaderProject({
          userId,
          clientId,
          authorizationCodeId,
          projectId: ownedA.projectId,
        }),
      )
      assert.equal(allowedA, ownedA.projectId)

      const wrongProject = await exec(
        getDelegatedReaderProject({
          userId,
          clientId,
          authorizationCodeId,
          projectId: randomUUID(),
        }),
      )
      assert.equal(wrongProject, undefined)

      const foreignCode = randomUUID()
      await db.insert(agentAccessGrantProjects).values({
        authorizationCodeId: foreignCode,
        projectId: ownedA.projectId,
      })
      const noRefreshForForeign = await exec(
        getDelegatedReaderProject({
          userId,
          clientId,
          authorizationCodeId: foreignCode,
          projectId: ownedA.projectId,
        }),
      )
      assert.equal(
        noRefreshForForeign,
        undefined,
        "grant row without active refresh must not authorize",
      )
      await db
        .delete(agentAccessGrantProjects)
        .where(eq(agentAccessGrantProjects.authorizationCodeId, foreignCode))

      const otherUserRead = await exec(
        getDelegatedReaderProject({
          userId: otherUserId,
          clientId,
          authorizationCodeId,
          projectId: ownedA.projectId,
        }),
      )
      assert.equal(otherUserRead, undefined)

      await assert.rejects(
        () =>
          exec(
            submitAgentAccessConsent({
              ...consentInput,
              projectIds: [ownedA.projectId, randomUUID()],
            }),
          ),
        (err): err is AgentAccessConsentRejected =>
          err instanceof AgentAccessConsentRejected,
      )

      await db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.userId, userId),
            eq(projectMembers.projectId, ownedA.projectId),
          ),
        )

      const staleMember = await exec(
        getDelegatedReaderProject({
          userId,
          clientId,
          authorizationCodeId,
          projectId: ownedA.projectId,
        }),
      )
      assert.equal(staleMember, undefined)

      await db.insert(projectMembers).values({
        userId,
        projectId: ownedA.projectId,
        role: "owner",
      })

      const concurrent = await Promise.all([
        exec(
          submitAgentAccessConsent({
            ...consentInput,
            projectIds: [ownedA.projectId, ownedB.projectId],
          }),
        ),
        exec(
          submitAgentAccessConsent({
            ...consentInput,
            projectIds: [ownedA.projectId, ownedB.projectId],
          }),
        ),
      ])
      assert.ok(
        concurrent.every((id) => id === authorizationCodeId),
        "concurrent identical consent should complete for same family",
      )
      const both = await exec(
        getDelegatedReaderProject({
          userId,
          clientId,
          authorizationCodeId,
          projectId: ownedB.projectId,
        }),
      )
      assert.equal(both, ownedB.projectId)

      await exec(
        revokeAgentAccessConnection({
          userId,
          clientId,
          authorizationCodeId,
        }),
      )
      const afterRevoke = await exec(
        getDelegatedReaderProject({
          userId,
          clientId,
          authorizationCodeId,
          projectId: ownedB.projectId,
        }),
      )
      assert.equal(afterRevoke, undefined)
    } finally {
      await db
        .delete(agentAccessOauthConsentIntents)
        .where(eq(agentAccessOauthConsentIntents.oauthConsentId, consentId))
      await db
        .delete(agentAccessGrantProjects)
        .where(
          eq(agentAccessGrantProjects.authorizationCodeId, authorizationCodeId),
        )
      await db
        .delete(oauthRefreshToken)
        .where(eq(oauthRefreshToken.userId, userId))
      await db.delete(oauthConsent).where(eq(oauthConsent.id, consentId))
      await db
        .delete(oauthClientResource)
        .where(eq(oauthClientResource.clientId, clientId))
      await db.delete(oauthClient).where(eq(oauthClient.clientId, clientId))
      await db
        .delete(oauthResource)
        .where(eq(oauthResource.id, oauthResourceRowId))
      if (createdProjectIds.length > 0) {
        await db
          .delete(projectApiKeys)
          .where(inArray(projectApiKeys.projectId, createdProjectIds))
        await db.delete(projectMembers).where(eq(projectMembers.userId, userId))
        await db.delete(projects).where(inArray(projects.id, createdProjectIds))
      }
      if (workspaceIds.length > 0) {
        await db.delete(workspaces).where(inArray(workspaces.id, workspaceIds))
      }
      await db.delete(user).where(inArray(user.id, [userId, otherUserId]))
      await close()
    }
  },
)
