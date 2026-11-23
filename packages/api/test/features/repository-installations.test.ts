import { randomUUID } from "node:crypto"
import {
  containsSecretMaterial,
  type DeployedArtifactMapping,
  type StoredRuntimeObservation,
} from "@flowmarkdev/core"
import type {
  RecordInstallationDeliveryOutcome,
  StoredRepositoryInstallation,
} from "@flowmark/db/persistence"
import { Array, Effect, Layer, Option, Result } from "effect"
import { describe, expect, it } from "vitest"
import { Unauthorized } from "../../src/errors.js"
import { AuthorizeProject } from "../../src/features/project-access/use-cases/authorize-project.js"
import {
  createLocalGitHubAdapter,
  UnconfiguredRepositoryHostAdapterLive,
} from "../../src/features/repository-installations/adapters/local-github-adapter.js"
import { RepositoryInstallationRepository } from "../../src/features/repository-installations/ports/repository-installation-repository.js"
import { RepositoryInstallations } from "../../src/features/repository-installations/use-cases/repository-installations.js"
import { Deployments } from "../../src/features/runtime-deployment/use-cases/deployments.js"
import type { ProjectReader } from "../../src/features/workflows/models/project-reader.js"
import {
  GetProjectWorkflowData,
  type GetProjectWorkflowDataService,
} from "../../src/features/workflows/use-cases/get-project-workflow-data.js"

const PROJECT_ID = "00000000-0000-4000-8000-000000000010"
const OWNER_ID = "user-owner"
const READER_ID = "user-diagnostic-reader"
const BINDING_ID = "00000000-0000-4000-8000-000000000020"
const RUN_ID = "00000000-0000-4000-8000-000000000030"
const ARTIFACT_DIGEST = `sha256:${"a".repeat(64)}`
const MANIFEST_DIGEST = `sha256:${"b".repeat(64)}`
const SOURCE_REVISION = "c".repeat(40)
const WEBHOOK_SECRET = "local-github-fixture-webhook-secret-1234"
const DEPLOYMENT_TOKEN = `fmd_${"d".repeat(64)}`

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

const narrowPermissions = {
  contents: "write" as const,
  pullRequests: "write" as const,
  metadata: "read" as const,
}

function makeHarness(options?: {
  readonly observations?: ReadonlyArray<StoredRuntimeObservation>
  readonly mappingPresent?: boolean
  readonly readerAuthorized?: boolean
  readonly host?: "local" | "unconfigured"
}) {
  const rows = new Map<string, StoredRepositoryInstallation>()
  const deliveries = new Set<string>()
  const activeGrantFamilies = new Set<string>([
    "install-grant-family",
    "independent-grant-family",
  ])
  const github = createLocalGitHubAdapter({
    webhookSecret: WEBHOOK_SECRET,
    authorizedRepositories: new Map([
      ["gh-inst-42", new Set(["example/bookings"])],
    ]),
    forbiddenSecretValues: [DEPLOYMENT_TOKEN, WEBHOOK_SECRET],
  })

  const repo = RepositoryInstallationRepository.of({
    list: (_userId, projectId) =>
      Effect.succeed(
        Array.filter(
          Array.fromIterable(rows.values()),
          (row) => row.projectId === projectId,
        ),
      ),
    get: (_userId, projectId, installationId) => {
      const row = rows.get(installationId)
      return Effect.succeed(row && row.projectId === projectId ? row : null)
    },
    getForProject: (projectId, installationId) => {
      const row = rows.get(installationId)
      return Effect.succeed(row && row.projectId === projectId ? row : null)
    },
    upsert: (userId, input) => {
      const now = new Date()
      const existing = Array.findFirst(
        Array.fromIterable(rows.values()),
        (row) =>
          row.projectId === input.projectId &&
          row.host === input.host &&
          row.repository === input.repository &&
          row.service === input.service &&
          row.environment === input.environment,
      )
      const id = Option.match(existing, {
        onSome: (row) => row.id,
        onNone: () => randomUUID(),
      })
      const createdAt = Option.match(existing, {
        onSome: (row) => row.createdAt,
        onNone: () => now,
      })
      const stored: StoredRepositoryInstallation = {
        id,
        projectId: input.projectId,
        bindingId: input.bindingId,
        host: input.host,
        runtime: input.runtime,
        repository: input.repository,
        service: input.service,
        environment: input.environment,
        externalInstallationId: input.externalInstallationId,
        policy: input.policy,
        status: "pending-verification",
        coldStartStatus: "pending-deployment-receipt",
        prBranch: null,
        prNumber: null,
        prUrl: null,
        prHeadSha: null,
        verifiedRunId: null,
        verifiedAt: null,
        delegatedAuthorizationCodeId:
          input.delegatedGrantFamily?.authorizationCodeId ?? null,
        delegatedClientId: input.delegatedGrantFamily?.clientId ?? null,
        delegatedUserId: input.delegatedGrantFamily ? userId : null,
        lastEventAt: null,
        revokedAt: null,
        createdAt,
        updatedAt: now,
      }
      rows.set(id, stored)
      return Effect.succeed(stored)
    },
    recordDelivery: (input) => {
      const candidates = Array.filter(
        Array.fromIterable(rows.values()),
        (row) =>
          row.host === input.host &&
          row.externalInstallationId === input.externalInstallationId,
      )
      if (candidates.length === 0) {
        return Effect.succeed({
          status: "not-found",
        } satisfies RecordInstallationDeliveryOutcome)
      }
      const match = Array.findFirst(
        candidates,
        (row) => row.repository === input.repository,
      )
      if (Option.isNone(match)) {
        return Effect.succeed({
          status: "foreign-repository",
          expectedRepository: candidates[0]!.repository,
        } satisfies RecordInstallationDeliveryOutcome)
      }
      const installation = match.value
      const deliveryKey = `${installation.id}:${input.deliveryId}`
      if (deliveries.has(deliveryKey)) {
        return Effect.succeed({
          status: "duplicate",
          installation,
        } satisfies RecordInstallationDeliveryOutcome)
      }
      if (installation.status === "revoked") {
        return Effect.succeed({
          status: "revoked",
          installation,
        } satisfies RecordInstallationDeliveryOutcome)
      }
      if (
        installation.lastEventAt !== null &&
        input.sentAt.getTime() < installation.lastEventAt.getTime()
      ) {
        return Effect.succeed({
          status: "stale",
          installation,
        } satisfies RecordInstallationDeliveryOutcome)
      }
      deliveries.add(deliveryKey)
      if (input.revoke) {
        if (installation.delegatedAuthorizationCodeId) {
          activeGrantFamilies.delete(installation.delegatedAuthorizationCodeId)
        }
        const updated: StoredRepositoryInstallation = {
          ...installation,
          status: "revoked",
          revokedAt: new Date(),
          lastEventAt: input.sentAt,
          updatedAt: new Date(),
        }
        rows.set(updated.id, updated)
        return Effect.succeed({
          status: "revoked-now",
          installation: updated,
        } satisfies RecordInstallationDeliveryOutcome)
      }
      const updated: StoredRepositoryInstallation = {
        ...installation,
        lastEventAt: input.sentAt,
        updatedAt: new Date(),
      }
      rows.set(updated.id, updated)
      return Effect.succeed({
        status: "accepted",
        installation: updated,
      } satisfies RecordInstallationDeliveryOutcome)
    },
    recordPr: (input) => {
      const existing = rows.get(input.installationId)
      if (!existing || existing.projectId !== input.projectId) {
        return Effect.succeed(null)
      }
      const updated: StoredRepositoryInstallation = {
        ...existing,
        prBranch: input.branch,
        prNumber: input.number,
        prUrl: input.url,
        prHeadSha: input.headSha,
        updatedAt: new Date(),
      }
      rows.set(updated.id, updated)
      return Effect.succeed(updated)
    },
    recordVerification: (input) => {
      const existing = rows.get(input.installationId)
      if (!existing || existing.projectId !== input.projectId) {
        return Effect.succeed(null)
      }
      const updated: StoredRepositoryInstallation = {
        ...existing,
        status: "active",
        coldStartStatus: input.coldStartStatus,
        verifiedRunId: input.runId,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      }
      rows.set(updated.id, updated)
      return Effect.succeed(updated)
    },
    revoke: (_userId, projectId, installationId) => {
      const existing = rows.get(installationId)
      if (!existing || existing.projectId !== projectId) {
        return Effect.succeed(null)
      }
      if (existing.delegatedAuthorizationCodeId) {
        activeGrantFamilies.delete(existing.delegatedAuthorizationCodeId)
      }
      const updated: StoredRepositoryInstallation = {
        ...existing,
        status: "revoked",
        revokedAt: new Date(),
        updatedAt: new Date(),
      }
      rows.set(updated.id, updated)
      return Effect.succeed(updated)
    },
  })

  const defaultObservations: ReadonlyArray<StoredRuntimeObservation> = [
    {
      binding: {
        status: "bound",
        revision: SOURCE_REVISION,
        manifestDigest: MANIFEST_DIGEST,
        behaviorId: "booking.reschedule",
        behaviorRevision: "1",
        environment: "production",
      },
      observation: {
        kind: "observation",
        probe: {
          bindingId: BINDING_ID,
          deploymentId: "deploy-1",
          artifactDigest: ARTIFACT_DIGEST,
          probeId: "bootstrap.probe",
        },
        references: [
          {
            kind: "entity",
            namespace: "booking",
            digest: `hmac-sha256:${"e".repeat(64)}`,
          },
          {
            kind: "change",
            namespace: "reschedule",
            digest: `hmac-sha256:${"f".repeat(64)}`,
          },
        ],
      },
    },
  ]

  const mapping: DeployedArtifactMapping = {
    bindingId: BINDING_ID,
    deploymentId: "deploy-1",
    environment: "production",
    service: "worker",
    manifestDigest: MANIFEST_DIGEST,
    manifest: {
      version: 1,
      repository: "example/bookings",
      revision: SOURCE_REVISION,
      artifactDigest: ARTIFACT_DIGEST,
      probes: [
        {
          probeId: "bootstrap.probe",
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
    receivedAt: "2026-11-23T10:00:00.000Z",
  }

  const workflowData = {
    runInvestigationSummary: (reader: ProjectReader, runId: string) =>
      options?.readerAuthorized === false
        ? Effect.fail(new Unauthorized({ permission: "read" }))
        : Effect.succeed({
            id: runId,
            workflow: "booking.reschedule",
            environment: "production",
            status: "Completed",
            reader,
          }),
    artifactMappings: () =>
      Effect.succeed({
        mappings: options?.mappingPresent === false ? [] : [mapping],
        truncated: false,
      }),
    runEventPage: () => {
      const observations = options?.observations ?? defaultObservations
      return Effect.succeed({
        events: Array.map(observations, (obs, index) => ({
          id: `evt-${index + 1}`,
          runtimeObservation: obs,
        })),
        totalEvents: observations.length,
        nextCursor: null,
      })
    },
  } as unknown as GetProjectWorkflowDataService

  const authLayer = Layer.succeed(AuthorizeProject, {
    authorizeOwner: (userId: string, projectId: string) =>
      userId === OWNER_ID && projectId === PROJECT_ID
        ? Effect.void
        : Effect.fail(new Unauthorized({ permission: "write" })),
  } as unknown as typeof AuthorizeProject.Service)

  const deploymentsLayer = Layer.succeed(Deployments, {
    rotateBinding: () =>
      Effect.succeed({ bindingId: BINDING_ID, token: DEPLOYMENT_TOKEN }),
    record: () => Effect.die("unused"),
    read: () => Effect.die("unused"),
  })

  const layer = RepositoryInstallations.layer.pipe(
    Layer.provide(Layer.succeed(RepositoryInstallationRepository, repo)),
    Layer.provide(
      options?.host === "unconfigured"
        ? UnconfiguredRepositoryHostAdapterLive
        : github.layer,
    ),
    Layer.provide(deploymentsLayer),
    Layer.provide(authLayer),
    Layer.provide(Layer.succeed(GetProjectWorkflowData, workflowData)),
  )

  return {
    layer,
    github,
    activeGrantFamilies,
    run: <A, E>(
      effect: Effect.Effect<A, E, RepositoryInstallations>,
    ): Promise<Result.Result<A, E>> =>
      Effect.runPromise(Effect.result(effect).pipe(Effect.provide(layer))),
  }
}

describe("RepositoryInstallations (RM-010 local GitHub adapter fixture)", () => {
  it("runs install, repeat delivery, grant narrowing, stale event, foreign repo, policy escalation, readback and uninstall", async () => {
    const harness = makeHarness()

    const connected = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.connect(OWNER_ID, {
          projectId: PROJECT_ID,
          host: "github",
          runtime: "node",
          repository: "example/bookings",
          service: "worker",
          environment: "production",
          externalInstallationId: "gh-inst-42",
          policy,
          delegatedGrantFamily: {
            authorizationCodeId: "install-grant-family",
            clientId: "cursor-mcp",
          },
        }),
      ),
    )
    expect(Result.isSuccess(connected)).toBe(true)
    if (Result.isFailure(connected)) {
      return
    }
    expect(connected.success.deploymentToken).toBe(DEPLOYMENT_TOKEN)
    expect(connected.success.installation.coldStartStatus).toBe(
      "pending-deployment-receipt",
    )
    const installationId = connected.success.installation.id

    // Non-owner cannot connect or list
    const foreignOwner = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.list("stranger-user", PROJECT_ID),
      ),
    )
    expect(Result.isFailure(foreignOwner)).toBe(true)

    // 1. First signed installation delivery opens bootstrap PR without secrets
    const createdBody = JSON.stringify({
      deliveryId: "deliv-1",
      sentAt: "2026-11-23T12:00:00.000Z",
      host: "github",
      externalInstallationId: "gh-inst-42",
      repository: "example/bookings",
      action: "created",
      repositories: ["example/bookings"],
      permissions: narrowPermissions,
    })
    const created = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.handleWebhookDelivery({
          signatureHeader: harness.github.sign(createdBody),
          rawBody: createdBody,
          apiOrigin: "https://api.flowmark.dev",
        }),
      ),
    )
    expect(Result.isSuccess(created)).toBe(true)
    if (Result.isFailure(created)) {
      return
    }
    expect(created.success.disposition).toBe("processed")
    expect(created.success.pullRequest?.action).toBe("created")
    expect(created.success.pullRequest?.number).toBe(1)
    expect(harness.github.listPullRequests()).toHaveLength(1)
    const pr = harness.github.listPullRequests()[0]!
    expect(pr.merged).toBe(false)
    expect(
      containsSecretMaterial(
        [pr.title, pr.body, ...pr.files.map((f) => f.content)].join("\n"),
        [DEPLOYMENT_TOKEN, WEBHOOK_SECRET],
      ),
    ).toBe(false)

    // 2. Duplicate delivery ID is idempotent
    const duplicate = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.handleWebhookDelivery({
          signatureHeader: harness.github.sign(createdBody),
          rawBody: createdBody,
          apiOrigin: "https://api.flowmark.dev",
        }),
      ),
    )
    expect(Result.isSuccess(duplicate)).toBe(true)
    if (Result.isSuccess(duplicate)) {
      expect(duplicate.success.disposition).toBe("duplicate")
    }
    expect(harness.github.listPullRequests()).toHaveLength(1)

    // 3. Subsequent update event updates the SAME PR instead of opening a second PR
    const updatedBody = JSON.stringify({
      deliveryId: "deliv-2",
      sentAt: "2026-11-23T12:05:00.000Z",
      host: "github",
      externalInstallationId: "gh-inst-42",
      repository: "example/bookings",
      action: "updated",
      repositories: ["example/bookings"],
      permissions: narrowPermissions,
    })
    const updated = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.handleWebhookDelivery({
          signatureHeader: harness.github.sign(updatedBody),
          rawBody: updatedBody,
          apiOrigin: "https://api.flowmark.dev",
        }),
      ),
    )
    expect(Result.isSuccess(updated)).toBe(true)
    if (Result.isSuccess(updated)) {
      expect(updated.success.pullRequest?.action).toBe("updated")
      expect(updated.success.pullRequest?.number).toBe(1)
    }
    expect(harness.github.listPullRequests()).toHaveLength(1)
    expect(harness.github.listPullRequests()[0]?.updateCount).toBe(2)

    // 4. Invalid signature rejected
    const badSig = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.handleWebhookDelivery({
          signatureHeader: "sha256=" + "0".repeat(64),
          rawBody: updatedBody,
          apiOrigin: "https://api.flowmark.dev",
        }),
      ),
    )
    expect(Result.isFailure(badSig)).toBe(true)
    if (Result.isFailure(badSig)) {
      expect(badSig.failure).toMatchObject({ reason: "invalid-signature" })
    }

    // 5. Grant narrowing rejected explicitly without escalating
    const narrowedBody = JSON.stringify({
      deliveryId: "deliv-narrow",
      sentAt: "2026-11-23T12:06:00.000Z",
      host: "github",
      externalInstallationId: "gh-inst-42",
      repository: "example/bookings",
      action: "updated",
      repositories: ["example/bookings"],
      permissions: {
        contents: "read",
        pullRequests: "write",
        metadata: "read",
      },
    })
    const narrowed = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.handleWebhookDelivery({
          signatureHeader: harness.github.sign(narrowedBody),
          rawBody: narrowedBody,
          apiOrigin: "https://api.flowmark.dev",
        }),
      ),
    )
    expect(Result.isFailure(narrowed)).toBe(true)
    if (Result.isFailure(narrowed)) {
      expect(narrowed.failure).toMatchObject({ reason: "grant-narrowed" })
    }

    // 6. Excess PR writer authority (canMerge) rejected
    const escalatedBody = JSON.stringify({
      deliveryId: "deliv-escalate",
      sentAt: "2026-11-23T12:07:00.000Z",
      host: "github",
      externalInstallationId: "gh-inst-42",
      repository: "example/bookings",
      action: "updated",
      repositories: ["example/bookings"],
      permissions: { ...narrowPermissions, canMerge: true },
    })
    const escalated = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.handleWebhookDelivery({
          signatureHeader: harness.github.sign(escalatedBody),
          rawBody: escalatedBody,
          apiOrigin: "https://api.flowmark.dev",
        }),
      ),
    )
    expect(Result.isFailure(escalated)).toBe(true)
    if (Result.isFailure(escalated)) {
      expect(escalated.failure).toMatchObject({
        reason: "policy-escalation-rejected",
      })
    }

    // 7. Stale event rejected
    const staleBody = JSON.stringify({
      deliveryId: "deliv-stale",
      sentAt: "2026-11-23T11:55:00.000Z",
      host: "github",
      externalInstallationId: "gh-inst-42",
      repository: "example/bookings",
      action: "updated",
      repositories: ["example/bookings"],
      permissions: narrowPermissions,
    })
    const stale = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.handleWebhookDelivery({
          signatureHeader: harness.github.sign(staleBody),
          rawBody: staleBody,
          apiOrigin: "https://api.flowmark.dev",
        }),
      ),
    )
    expect(Result.isFailure(stale)).toBe(true)
    if (Result.isFailure(stale)) {
      expect(stale.failure).toMatchObject({ reason: "stale-event" })
    }

    // 8. Foreign repository attempt rejected
    const foreignRepoBody = JSON.stringify({
      deliveryId: "deliv-foreign",
      sentAt: "2026-11-23T12:08:00.000Z",
      host: "github",
      externalInstallationId: "gh-inst-42",
      repository: "other-org/foreign-repo",
      action: "created",
      repositories: ["other-org/foreign-repo"],
      permissions: narrowPermissions,
    })
    const foreignRepo = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.handleWebhookDelivery({
          signatureHeader: harness.github.sign(foreignRepoBody),
          rawBody: foreignRepoBody,
          apiOrigin: "https://api.flowmark.dev",
        }),
      ),
    )
    expect(Result.isFailure(foreignRepo)).toBe(true)
    if (Result.isFailure(foreignRepo)) {
      expect(foreignRepo.failure).toMatchObject({
        reason: "foreign-repository",
      })
    }

    // 9. Disposable readback verified using a separate diagnostic read identity
    const verified = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.verifyDisposableReadback(
          { _tag: "User", userId: READER_ID, projectId: PROJECT_ID },
          {
            projectId: PROJECT_ID,
            installationId,
            runId: RUN_ID,
            deploymentId: "deploy-1",
            artifactDigest: ARTIFACT_DIGEST,
            probeId: "bootstrap.probe",
          },
        ),
      ),
    )
    expect(Result.isSuccess(verified)).toBe(true)
    if (Result.isSuccess(verified)) {
      expect(verified.success.installation.status).toBe("active")
      expect(verified.success.installation.coldStartStatus).toBe(
        "pending-eligible-traffic",
      )
      expect(verified.success.verifiedEventIds).toEqual(["evt-1"])
    }

    // 10. Uninstall revokes the installation and ONLY its linked delegated grant family
    const uninstallBody = JSON.stringify({
      deliveryId: "deliv-uninstall",
      sentAt: "2026-11-23T12:10:00.000Z",
      host: "github",
      externalInstallationId: "gh-inst-42",
      repository: "example/bookings",
      action: "deleted",
      repositories: [],
      permissions: narrowPermissions,
    })
    const uninstalled = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.handleWebhookDelivery({
          signatureHeader: harness.github.sign(uninstallBody),
          rawBody: uninstallBody,
          apiOrigin: "https://api.flowmark.dev",
        }),
      ),
    )
    expect(Result.isSuccess(uninstalled)).toBe(true)
    if (Result.isSuccess(uninstalled)) {
      expect(uninstalled.success.disposition).toBe("revoked")
      expect(uninstalled.success.installation.status).toBe("revoked")
    }
    expect(harness.activeGrantFamilies.has("install-grant-family")).toBe(false)
    expect(harness.activeGrantFamilies.has("independent-grant-family")).toBe(
      true,
    )

    // Subsequent PR writes and deliveries are rejected after uninstall
    const afterUninstallBody = JSON.stringify({
      deliveryId: "deliv-after-uninstall",
      sentAt: "2026-11-23T12:11:00.000Z",
      host: "github",
      externalInstallationId: "gh-inst-42",
      repository: "example/bookings",
      action: "updated",
      repositories: ["example/bookings"],
      permissions: narrowPermissions,
    })
    const afterUninstall = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.handleWebhookDelivery({
          signatureHeader: harness.github.sign(afterUninstallBody),
          rawBody: afterUninstallBody,
          apiOrigin: "https://api.flowmark.dev",
        }),
      ),
    )
    expect(Result.isFailure(afterUninstall)).toBe(true)
    if (Result.isFailure(afterUninstall)) {
      expect(afterUninstall.failure).toMatchObject({
        reason: "installation-revoked",
      })
    }
  })

  it("rejects disposable readback when observation namespaces exceed policy or reader is unauthorized", async () => {
    const violatingHarness = makeHarness({
      observations: [
        {
          binding: {
            status: "bound",
            revision: SOURCE_REVISION,
            manifestDigest: MANIFEST_DIGEST,
            behaviorId: "booking.reschedule",
            behaviorRevision: "1",
            environment: "production",
          },
          observation: {
            kind: "observation",
            probe: {
              bindingId: BINDING_ID,
              deploymentId: "deploy-1",
              artifactDigest: ARTIFACT_DIGEST,
              probeId: "bootstrap.probe",
            },
            references: [
              {
                kind: "entity",
                namespace: "unapproved.pii",
                digest: `hmac-sha256:${"e".repeat(64)}`,
              },
            ],
          },
        },
      ],
    })
    const connected = await violatingHarness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.connect(OWNER_ID, {
          projectId: PROJECT_ID,
          host: "github",
          runtime: "node",
          repository: "example/bookings",
          service: "worker",
          environment: "production",
          externalInstallationId: "gh-inst-42",
          policy,
        }),
      ),
    )
    expect(Result.isSuccess(connected)).toBe(true)
    if (Result.isFailure(connected)) {
      return
    }

    const policyRejected = await violatingHarness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.verifyDisposableReadback(
          { _tag: "User", userId: READER_ID, projectId: PROJECT_ID },
          {
            projectId: PROJECT_ID,
            installationId: connected.success.installation.id,
            runId: RUN_ID,
            deploymentId: "deploy-1",
            artifactDigest: ARTIFACT_DIGEST,
            probeId: "bootstrap.probe",
          },
        ),
      ),
    )
    expect(Result.isFailure(policyRejected)).toBe(true)
    if (Result.isFailure(policyRejected)) {
      expect(policyRejected.failure).toMatchObject({
        reason: "verification-failed",
      })
    }

    const unauthorizedHarness = makeHarness({ readerAuthorized: false })
    const unauthConnected = await unauthorizedHarness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.connect(OWNER_ID, {
          projectId: PROJECT_ID,
          host: "github",
          runtime: "node",
          repository: "example/bookings",
          service: "worker",
          environment: "production",
          externalInstallationId: "gh-inst-42",
          policy,
        }),
      ),
    )
    expect(Result.isSuccess(unauthConnected)).toBe(true)
    if (Result.isFailure(unauthConnected)) {
      return
    }
    const denied = await unauthorizedHarness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.verifyDisposableReadback(
          { _tag: "User", userId: "denied-user", projectId: PROJECT_ID },
          {
            projectId: PROJECT_ID,
            installationId: unauthConnected.success.installation.id,
            runId: RUN_ID,
            deploymentId: "deploy-1",
            artifactDigest: ARTIFACT_DIGEST,
            probeId: "bootstrap.probe",
          },
        ),
      ),
    )
    expect(Result.isFailure(denied)).toBe(true)
    if (Result.isFailure(denied)) {
      expect(denied.failure).toMatchObject({ _tag: "Unauthorized" })
    }
  })

  it("stores one pull request from the local host and refuses a second installation write after revocation", async () => {
    const harness = makeHarness()
    const connected = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.connect(OWNER_ID, {
          projectId: PROJECT_ID,
          host: "github",
          runtime: "node",
          repository: "example/bookings",
          service: "worker",
          environment: "production",
          externalInstallationId: "gh-inst-42",
          policy,
        }),
      ),
    )
    expect(Result.isSuccess(connected)).toBe(true)
    if (Result.isFailure(connected)) {
      return
    }
    const installationId = connected.success.installation.id
    const prepare = (userId: string) =>
      harness.run(
        Effect.flatMap(RepositoryInstallations, (service) =>
          service.prepareBootstrapPr(userId, {
            projectId: PROJECT_ID,
            installationId,
            apiOrigin: "https://api.flowmark.test",
            permissions: narrowPermissions,
          }),
        ),
      )
    const opened = await prepare(OWNER_ID)
    expect(Result.isSuccess(opened)).toBe(true)
    if (Result.isFailure(opened)) {
      return
    }
    expect(opened.success.status).toBe("opened")
    if (opened.success.status !== "opened") {
      return
    }
    expect(opened.success.installation.bootstrapPr?.url).toBe(
      opened.success.pullRequest.url,
    )
    expect(
      opened.success.plan.files
        .map((file) => file.content)
        .join("\n")
        .includes(connected.success.deploymentToken),
    ).toBe(false)
    const repeated = await prepare(OWNER_ID)
    expect(Result.isSuccess(repeated)).toBe(true)
    if (Result.isFailure(repeated) || repeated.success.status !== "opened") {
      return
    }
    expect(repeated.success.pullRequest.number).toBe(
      opened.success.pullRequest.number,
    )
    expect(harness.github.listPullRequests()).toHaveLength(1)

    const stranger = await prepare("stranger-user")
    expect(Result.isFailure(stranger)).toBe(true)
    if (Result.isFailure(stranger)) {
      expect(stranger.failure).toMatchObject({ _tag: "Unauthorized" })
    }

    const revoked = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.revoke(OWNER_ID, {
          projectId: PROJECT_ID,
          installationId,
        }),
      ),
    )
    expect(Result.isSuccess(revoked)).toBe(true)
    const afterRevoke = await prepare(OWNER_ID)
    expect(Result.isFailure(afterRevoke)).toBe(true)
    if (Result.isFailure(afterRevoke)) {
      expect(afterRevoke.failure).toMatchObject({
        reason: "installation-revoked",
      })
    }
    expect(harness.github.listPullRequests()).toHaveLength(1)
  })

  it("returns the bootstrap files and no pull request when the host is unconfigured", async () => {
    const harness = makeHarness({ host: "unconfigured" })
    const connected = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.connect(OWNER_ID, {
          projectId: PROJECT_ID,
          host: "github",
          runtime: "node",
          repository: "example/bookings",
          service: "worker",
          environment: "production",
          externalInstallationId: "gh-inst-42",
          policy,
        }),
      ),
    )
    expect(Result.isSuccess(connected)).toBe(true)
    if (Result.isFailure(connected)) {
      return
    }
    const prepared = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.prepareBootstrapPr(OWNER_ID, {
          projectId: PROJECT_ID,
          installationId: connected.success.installation.id,
          apiOrigin: "https://api.flowmark.test",
          permissions: narrowPermissions,
        }),
      ),
    )
    expect(Result.isSuccess(prepared)).toBe(true)
    if (Result.isFailure(prepared)) {
      return
    }
    expect(prepared.success.status).toBe("pr-not-opened")
    if (prepared.success.status !== "pr-not-opened") {
      return
    }
    expect(prepared.success.installation.bootstrapPr).toBeNull()
    expect(prepared.success.plan.files.length).toBeGreaterThan(0)
    expect(prepared.success.reason).toBe("host-unconfigured")
    expect(
      prepared.success.plan.files
        .map((file) => file.content)
        .join("\n")
        .includes(connected.success.deploymentToken),
    ).toBe(false)
  })

  it("rejects a secret-bearing bootstrap plan before opening a pull request", async () => {
    const harness = makeHarness()
    const connected = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.connect(OWNER_ID, {
          projectId: PROJECT_ID,
          host: "github",
          runtime: "node",
          repository: "example/bookings",
          service: "worker",
          environment: "production",
          externalInstallationId: "gh-inst-42",
          policy,
        }),
      ),
    )
    expect(Result.isSuccess(connected)).toBe(true)
    if (Result.isFailure(connected)) {
      return
    }
    const leaked = await harness.run(
      Effect.flatMap(RepositoryInstallations, (service) =>
        service.prepareBootstrapPr(OWNER_ID, {
          projectId: PROJECT_ID,
          installationId: connected.success.installation.id,
          apiOrigin: `https://example.com/fmd_${"ab".repeat(16)}`,
          permissions: narrowPermissions,
        }),
      ),
    )
    expect(Result.isFailure(leaked)).toBe(true)
    if (Result.isFailure(leaked)) {
      expect(leaked.failure).toMatchObject({ reason: "secret-leak-blocked" })
    }
    expect(harness.github.listPullRequests()).toHaveLength(0)
  })
})
