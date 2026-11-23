import {
  RepositoryInstallationBootstrapInputSchema,
  RepositoryInstallationCreateSchema,
  RepositoryInstallationEventSchema,
  RepositoryInstallationRevokeSchema,
  RepositoryInstallationVerifyReadbackSchema,
  buildNodeBootstrapPrPlan,
  containsSecretMaterial,
  describeColdStartState,
  evaluateWriterPermissions,
  type RepositoryCollectionPolicy,
} from "@flowmarkdev/core"
import type { StoredRepositoryInstallation } from "@flowmark/db/persistence"
import { Array, Context, Effect, Layer, Match, Option, Schema } from "effect"
import { InvalidInput } from "../../../errors.js"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import { Deployments } from "../../runtime-deployment/use-cases/deployments.js"
import type { ProjectReader } from "../../workflows/models/project-reader.js"
import { GetProjectWorkflowData } from "../../workflows/use-cases/get-project-workflow-data.js"
import { RepositoryInstallationRejected } from "../errors.js"
import { RepositoryHostAdapter } from "../ports/repository-host-adapter.js"
import { RepositoryInstallationRepository } from "../ports/repository-installation-repository.js"

const presentInstallation = (row: StoredRepositoryInstallation) => ({
  id: row.id,
  projectId: row.projectId,
  bindingId: row.bindingId,
  host: row.host,
  runtime: row.runtime,
  repository: row.repository,
  service: row.service,
  environment: row.environment,
  externalInstallationId: row.externalInstallationId,
  policy: row.policy,
  status: row.status,
  coldStartStatus: row.coldStartStatus,
  coldStart: describeColdStartState(row.coldStartStatus),
  bootstrapPr:
    row.prBranch && row.prNumber !== null && row.prUrl && row.prHeadSha
      ? {
          branch: row.prBranch,
          number: row.prNumber,
          url: row.prUrl,
          headSha: row.prHeadSha,
        }
      : null,
  verifiedRunId: row.verifiedRunId,
  verifiedAt: row.verifiedAt?.toISOString() ?? null,
  hasLinkedDelegatedGrant: row.delegatedAuthorizationCodeId !== null,
  lastEventAt: row.lastEventAt?.toISOString() ?? null,
  revokedAt: row.revokedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export type RepositoryInstallationView = ReturnType<typeof presentInstallation>

const namespaceAllowed = (
  policy: RepositoryCollectionPolicy,
  kind: string,
  namespace: string,
) =>
  Array.some(
    policy.allowedNamespaces,
    (entry) => entry.kind === kind && entry.namespace === namespace,
  )

const isRevokingAction = (
  event: typeof RepositoryInstallationEventSchema.Type,
) =>
  event.action === "deleted" ||
  event.action === "suspend" ||
  (event.action === "repositories_removed" &&
    !event.repositories.includes(event.repository))

export class RepositoryInstallations extends Context.Service<RepositoryInstallations>()(
  "@flowmark/api/RepositoryInstallations",
  {
    make: Effect.gen(function* () {
      const repo = yield* RepositoryInstallationRepository
      const hostAdapter = yield* RepositoryHostAdapter
      const deployments = yield* Deployments
      const authorization = yield* AuthorizeProject
      const workflowData = yield* GetProjectWorkflowData

      const runBootstrapPr = Effect.fn(
        "RepositoryInstallations.runBootstrapPr",
      )(function* (
        installation: StoredRepositoryInstallation,
        input: {
          readonly apiOrigin: string
          readonly mcpOrigin: string
          readonly permissions: (typeof RepositoryInstallationBootstrapInputSchema.Type)["permissions"]
        },
      ) {
        if (installation.status === "revoked") {
          return yield* new RepositoryInstallationRejected({
            reason: "installation-revoked",
            detail: "Revoked repository installation cannot update PRs.",
          })
        }
        const permissionCheck = evaluateWriterPermissions(input.permissions)
        if (permissionCheck.status === "policy-escalation-rejected") {
          return yield* new RepositoryInstallationRejected({
            reason: "policy-escalation-rejected",
            detail: `PR writer cannot hold excess repository permissions: ${permissionCheck.excess.join(", ")}.`,
          })
        }
        if (permissionCheck.status === "grant-narrowed") {
          return yield* new RepositoryInstallationRejected({
            reason: "grant-narrowed",
            detail: `Repository installation grant is missing required permissions: ${permissionCheck.missing.join(", ")}.`,
          })
        }
        const plan = buildNodeBootstrapPrPlan({
          projectId: installation.projectId,
          installationId: installation.id,
          bindingId: installation.bindingId,
          repository: installation.repository,
          service: installation.service,
          environment: installation.environment,
          policy: installation.policy,
          coldStartStatus: installation.coldStartStatus,
          apiOrigin: input.apiOrigin,
          mcpOrigin: input.mcpOrigin,
        })
        const combined = [
          plan.title,
          plan.body,
          ...Array.map(plan.files, (file) => file.content),
        ].join("\n")
        if (containsSecretMaterial(combined)) {
          return yield* new RepositoryInstallationRejected({
            reason: "secret-leak-blocked",
            detail: "Bootstrap PR plan contained prohibited secret material.",
          })
        }
        const pullRequest = yield* hostAdapter.upsertBootstrapPullRequest({
          externalInstallationId: installation.externalInstallationId,
          repository: installation.repository,
          branch: plan.branch,
          title: plan.title,
          body: plan.body,
          files: plan.files,
          permissions: input.permissions,
        })
        const updated = yield* repo.recordPr({
          projectId: installation.projectId,
          installationId: installation.id,
          branch: pullRequest.branch,
          number: pullRequest.number,
          url: pullRequest.url,
          headSha: pullRequest.headSha,
        })
        return {
          installation: presentInstallation(updated ?? installation),
          pullRequest,
          plan,
        }
      })

      return {
        connect: Effect.fn("RepositoryInstallations.connect")(function* (
          userId: string,
          rawInput: unknown,
        ) {
          const input = yield* Schema.decodeUnknownEffect(
            RepositoryInstallationCreateSchema,
            { onExcessProperty: "error" },
          )(rawInput).pipe(
            Effect.mapError((cause) => new InvalidInput({ cause })),
          )
          yield* authorization.authorizeOwner(userId, input.projectId)
          const binding = yield* deployments.rotateBinding(userId, {
            projectId: input.projectId,
            repository: input.repository,
            service: input.service,
            environment: input.environment,
          })
          const stored = yield* repo.upsert(userId, {
            projectId: input.projectId,
            bindingId: binding.bindingId,
            host: input.host,
            runtime: input.runtime,
            repository: input.repository,
            service: input.service,
            environment: input.environment,
            externalInstallationId: input.externalInstallationId,
            policy: input.policy,
            delegatedGrantFamily: input.delegatedGrantFamily,
          })
          return {
            installation: presentInstallation(stored),
            deploymentToken: binding.token,
          }
        }),

        list: Effect.fn("RepositoryInstallations.list")(function* (
          userId: string,
          projectId: string,
        ) {
          yield* authorization.authorizeOwner(userId, projectId)
          const rows = yield* repo.list(userId, projectId)
          return Array.map(rows, presentInstallation)
        }),

        get: Effect.fn("RepositoryInstallations.get")(function* (
          userId: string,
          projectId: string,
          installationId: string,
        ) {
          yield* authorization.authorizeOwner(userId, projectId)
          const row = yield* repo.get(userId, projectId, installationId)
          if (!row) {
            return yield* new RepositoryInstallationRejected({
              reason: "installation-not-found",
              detail: "Repository installation was not found for this project.",
            })
          }
          return presentInstallation(row)
        }),

        prepareBootstrapPr: Effect.fn(
          "RepositoryInstallations.prepareBootstrapPr",
        )(function* (userId: string, rawInput: unknown) {
          const input = yield* Schema.decodeUnknownEffect(
            RepositoryInstallationBootstrapInputSchema,
            { onExcessProperty: "error" },
          )(rawInput).pipe(
            Effect.mapError((cause) => new InvalidInput({ cause })),
          )
          yield* authorization.authorizeOwner(userId, input.projectId)
          const installation = yield* repo.get(
            userId,
            input.projectId,
            input.installationId,
          )
          if (!installation) {
            return yield* new RepositoryInstallationRejected({
              reason: "installation-not-found",
              detail: "Repository installation was not found for this project.",
            })
          }
          const mcpOrigin =
            input.mcpOrigin ?? new URL("/mcp", input.apiOrigin).href
          return yield* runBootstrapPr(installation, {
            apiOrigin: input.apiOrigin,
            mcpOrigin,
            permissions: input.permissions,
          })
        }),

        handleWebhookDelivery: Effect.fn(
          "RepositoryInstallations.handleWebhookDelivery",
        )(function* (input: {
          readonly signatureHeader: string | null
          readonly rawBody: string
          readonly apiOrigin: string
          readonly mcpOrigin?: string
        }) {
          yield* hostAdapter.verifyWebhookSignature(
            input.signatureHeader,
            input.rawBody,
          )
          const decodedJson = yield* Effect.try({
            try: () => JSON.parse(input.rawBody) as unknown,
            catch: (cause) => new InvalidInput({ cause }),
          })
          const event = yield* Schema.decodeUnknownEffect(
            RepositoryInstallationEventSchema,
            { onExcessProperty: "error" },
          )(decodedJson).pipe(
            Effect.mapError((cause) => new InvalidInput({ cause })),
          )
          const revoke = isRevokingAction(event)
          if (!revoke && !event.repositories.includes(event.repository)) {
            return yield* new RepositoryInstallationRejected({
              reason: "foreign-repository",
              detail:
                "Target repository is not included in the authorized installation event.",
            })
          }
          if (!revoke) {
            const permissionCheck = evaluateWriterPermissions(event.permissions)
            if (permissionCheck.status === "policy-escalation-rejected") {
              return yield* new RepositoryInstallationRejected({
                reason: "policy-escalation-rejected",
                detail: `PR writer cannot hold excess repository permissions: ${permissionCheck.excess.join(", ")}.`,
              })
            }
            if (permissionCheck.status === "grant-narrowed") {
              return yield* new RepositoryInstallationRejected({
                reason: "grant-narrowed",
                detail: `Installation grant narrowed; missing ${permissionCheck.missing.join(", ")}.`,
              })
            }
          }
          const outcome = yield* repo.recordDelivery({
            host: event.host,
            externalInstallationId: event.externalInstallationId,
            repository: event.repository,
            deliveryId: event.deliveryId,
            action: event.action,
            sentAt: new Date(event.sentAt),
            revoke,
          })
          return yield* Match.value(outcome).pipe(
            Match.when({ status: "not-found" }, () =>
              Effect.fail(
                new RepositoryInstallationRejected({
                  reason: "installation-not-found",
                  detail: "No matching repository installation is connected.",
                }),
              ),
            ),
            Match.when({ status: "foreign-repository" }, () =>
              Effect.fail(
                new RepositoryInstallationRejected({
                  reason: "foreign-repository",
                  detail:
                    "Delivery repository does not match the authorized installation repository.",
                }),
              ),
            ),
            Match.when({ status: "revoked" }, () =>
              Effect.fail(
                new RepositoryInstallationRejected({
                  reason: "installation-revoked",
                  detail: "Installation is revoked and rejects further events.",
                }),
              ),
            ),
            Match.when({ status: "stale" }, () =>
              Effect.fail(
                new RepositoryInstallationRejected({
                  reason: "stale-event",
                  detail:
                    "Delivery timestamp is older than the latest processed event.",
                }),
              ),
            ),
            Match.when({ status: "duplicate" }, ({ installation }) =>
              Effect.succeed({
                disposition: "duplicate" as const,
                installation: presentInstallation(installation),
                pullRequest: null,
              }),
            ),
            Match.when({ status: "revoked-now" }, ({ installation }) =>
              Effect.succeed({
                disposition: "revoked" as const,
                installation: presentInstallation(installation),
                pullRequest: null,
              }),
            ),
            Match.when({ status: "accepted" }, ({ installation }) =>
              Effect.gen(function* () {
                const mcpOrigin =
                  input.mcpOrigin ?? new URL("/mcp", input.apiOrigin).href
                const result = yield* runBootstrapPr(installation, {
                  apiOrigin: input.apiOrigin,
                  mcpOrigin,
                  permissions: event.permissions,
                })
                return {
                  disposition: "processed" as const,
                  installation: result.installation,
                  pullRequest: result.pullRequest,
                }
              }),
            ),
            Match.exhaustive,
          )
        }),

        verifyDisposableReadback: Effect.fn(
          "RepositoryInstallations.verifyDisposableReadback",
        )(function* (reader: ProjectReader, rawInput: unknown) {
          const input = yield* Schema.decodeUnknownEffect(
            RepositoryInstallationVerifyReadbackSchema,
            { onExcessProperty: "error" },
          )(rawInput).pipe(
            Effect.mapError((cause) => new InvalidInput({ cause })),
          )
          // Exercises the caller's diagnostic read authority on the target project first.
          const summary = yield* workflowData.runInvestigationSummary(
            reader,
            input.runId,
          )
          const installation = yield* repo.getForProject(
            input.projectId,
            input.installationId,
          )
          if (!installation) {
            return yield* new RepositoryInstallationRejected({
              reason: "installation-not-found",
              detail: "Repository installation was not found for this project.",
            })
          }
          if (installation.status === "revoked") {
            return yield* new RepositoryInstallationRejected({
              reason: "installation-revoked",
              detail: "Revoked repository installation cannot be verified.",
            })
          }
          if (summary.environment !== installation.environment) {
            return yield* new RepositoryInstallationRejected({
              reason: "verification-failed",
              detail:
                "Persisted verification run environment does not match the installation environment.",
            })
          }
          const mappings = yield* workflowData.artifactMappings(reader, {
            repository: installation.repository,
            environment: installation.environment,
            receipt: {
              bindingId: installation.bindingId,
              deploymentId: input.deploymentId,
            },
          })
          const [mapping] = mappings.mappings
          if (
            !mapping ||
            mapping.service !== installation.service ||
            mapping.manifest.artifactDigest !== input.artifactDigest
          ) {
            return yield* new RepositoryInstallationRejected({
              reason: "verification-failed",
              detail:
                "Deployment receipt for the installation binding and artifact digest was not found.",
            })
          }
          const page = yield* workflowData.runEventPage(reader, {
            runId: input.runId,
            observationsOnly: true,
            limit: 25,
          })
          if (page.nextCursor !== null || page.events.length === 0) {
            return yield* new RepositoryInstallationRejected({
              reason: "verification-failed",
              detail:
                "Disposable verification run does not have a complete bounded set of runtime observations.",
            })
          }
          const observations = Array.getSomes(
            Array.map(page.events, (event) =>
              Option.fromNullishOr(event.runtimeObservation).pipe(
                Option.map((stored) => ({ eventId: event.id, stored })),
              ),
            ),
          )
          if (
            Array.some(
              observations,
              ({ stored }) => stored.observation.kind === "loss",
            )
          ) {
            return yield* new RepositoryInstallationRejected({
              reason: "verification-failed",
              detail:
                "Disposable verification run reported capture loss and cannot be verified.",
            })
          }
          const boundMatches = Array.filter(observations, ({ stored }) => {
            if (
              stored.binding.status !== "bound" ||
              stored.observation.kind !== "observation" ||
              !stored.observation.probe
            ) {
              return false
            }
            const probe = stored.observation.probe
            return (
              probe.bindingId === installation.bindingId &&
              probe.deploymentId === input.deploymentId &&
              probe.artifactDigest === input.artifactDigest &&
              probe.probeId === input.probeId &&
              stored.binding.environment === installation.environment &&
              stored.binding.manifestDigest === mapping.manifestDigest
            )
          })
          if (boundMatches.length === 0) {
            return yield* new RepositoryInstallationRejected({
              reason: "verification-failed",
              detail:
                "No bound runtime observation matched the installation binding, artifact and probe.",
            })
          }
          const policyViolation = Array.some(boundMatches, ({ stored }) => {
            if (stored.observation.kind !== "observation") {
              return true
            }
            return Array.some(
              stored.observation.references,
              (ref) =>
                !namespaceAllowed(installation.policy, ref.kind, ref.namespace),
            )
          })
          if (policyViolation) {
            return yield* new RepositoryInstallationRejected({
              reason: "verification-failed",
              detail:
                "Observation references exceeded the installation collection policy allowlist.",
            })
          }
          const updated = yield* repo.recordVerification({
            projectId: installation.projectId,
            installationId: installation.id,
            runId: input.runId,
            coldStartStatus: "pending-eligible-traffic",
          })
          return {
            installation: presentInstallation(updated ?? installation),
            verifiedEventIds: Array.map(boundMatches, ({ eventId }) => eventId),
          }
        }),

        revoke: Effect.fn("RepositoryInstallations.revoke")(function* (
          userId: string,
          rawInput: unknown,
        ) {
          const input = yield* Schema.decodeUnknownEffect(
            RepositoryInstallationRevokeSchema,
            { onExcessProperty: "error" },
          )(rawInput).pipe(
            Effect.mapError((cause) => new InvalidInput({ cause })),
          )
          yield* authorization.authorizeOwner(userId, input.projectId)
          const updated = yield* repo.revoke(
            userId,
            input.projectId,
            input.installationId,
          )
          if (!updated) {
            return yield* new RepositoryInstallationRejected({
              reason: "installation-not-found",
              detail: "Repository installation was not found for this project.",
            })
          }
          return presentInstallation(updated)
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
