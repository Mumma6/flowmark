import { requireAgentAccessProjectId } from "@flowmark/auth/agent-access"
import {
  GetProjectWorkflowData,
  rankChangeMappings,
  type AuthorizeAgentRead,
  type ProjectReader,
} from "@flowmark/api"
import { Array, Effect, Schema } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolInputError, McpToolReadError } from "../../errors.js"
import {
  assertHistoryWindow,
  type McpToolFailure,
} from "../../tools/response.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"

const boundedString = (maxLength: number) =>
  Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(maxLength))

export const ContextForChangeSchema = Schema.Struct({
  version: Schema.Literal(1),
  projectId: Schema.String.check(Schema.isUUID()),
  repository: Schema.String.check(
    Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/),
  ),
  environment: Schema.optional(boundedString(80)),
  startedAfter: boundedString(40),
  startedBefore: boundedString(40),
  revision: Schema.optional(
    Schema.String.check(Schema.isPattern(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)),
  ),
  ticket: Schema.optional(boundedString(2000)),
  plan: Schema.optional(boundedString(2000)),
  diff: Schema.optional(boundedString(12000)),
  files: Schema.optional(
    Schema.Array(boundedString(512)).check(Schema.isMaxLength(20)),
  ),
  symbols: Schema.optional(
    Schema.Array(boundedString(256)).check(Schema.isMaxLength(20)),
  ),
}).check(
  Schema.makeFilter(({ ticket, plan, diff, files, symbols }) =>
    Boolean(
      ticket?.trim() ||
      plan?.trim() ||
      diff?.trim() ||
      files?.length ||
      symbols?.length,
    ),
  ),
)

type Candidate = ReturnType<typeof rankChangeMappings>["candidates"][number]

const readCases = Effect.fn("ContextForChange.readCases")(function* (
  reader: ProjectReader,
  window: { readonly startedAfter: string; readonly startedBefore: string },
  { deployment: { bindingId, deploymentId, manifest }, probe }: Candidate,
) {
  const queries = yield* GetProjectWorkflowData
  const page = yield* queries.listRuns(reader, {
    ...window,
    namespace: "application",
    executionSelector: {
      bindingId,
      deploymentId,
      artifactDigest: manifest.artifactDigest,
      probeId: probe.probeId,
    },
    limit: 4,
  })
  const cases = yield* Effect.forEach(
    page.runs,
    (run) =>
      Effect.gen(function* () {
        const observed = yield* queries.runEventPage(reader, {
          runId: run.id,
          observationsOnly: true,
          limit: 12,
        })
        const events = observed.events.filter(
          ({ runtimeObservation }) =>
            runtimeObservation?.binding.status === "bound" &&
            runtimeObservation.observation.probe?.bindingId === bindingId &&
            runtimeObservation.observation.probe?.deploymentId ===
              deploymentId &&
            runtimeObservation.observation.probe?.probeId === probe.probeId,
        )
        const envelopesByChange = new Map<string, Set<string>>()
        Array.forEach(events, ({ runtimeObservation }) => {
          const observation = runtimeObservation?.observation
          if (observation?.kind !== "observation") {
            return
          }
          const changes = observation.references.filter(
            ({ kind }) => kind === "change",
          )
          const envelopes = observation.references.filter(
            ({ kind }) => kind === "envelope",
          )
          if (changes.length !== 1 || envelopes.length !== 1) {
            return
          }
          const [change] = changes
          const [envelope] = envelopes
          if (!change || !envelope) {
            return
          }
          const identity = JSON.stringify([change.namespace, change.digest])
          const deliveries =
            envelopesByChange.get(identity) ?? new Set<string>()
          deliveries.add(JSON.stringify([envelope.namespace, envelope.digest]))
          envelopesByChange.set(identity, deliveries)
        })
        const multipleEnvelopes = Array.some(
          Array.fromIterable(envelopesByChange.values()),
          (envelopes) => envelopes.size > 1,
        )
        return {
          runId: run.id,
          startedAt: run.startedAt,
          status: run.status,
          outcome: run.outcome ?? null,
          eventIds: events.map(({ id }) => id),
          observedShape: multipleEnvelopes
            ? "multiple-envelopes-for-one-change"
            : "sampled-execution",
          evidencePageTruncated: observed.nextCursor !== null,
        }
      }),
    { concurrency: 2 },
  )
  return {
    cases: cases.filter(({ eventIds }) => eventIds.length > 0),
    total: page.total,
  }
})

export const contextForChangeForMcp: (
  identity: FlowmarkMcpAuthInfo,
  raw: unknown,
) => Effect.Effect<
  Record<string, unknown>,
  McpToolFailure,
  GetProjectWorkflowData | AuthorizeAgentRead
> = Effect.fn("ContextForChange.execute")(
  function* (identity: FlowmarkMcpAuthInfo, raw: unknown) {
    const input = yield* Schema.decodeUnknownEffect(ContextForChangeSchema, {
      onExcessProperty: "error",
    })(raw).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason:
              "Supply version 1, an authorized project, repository, bounded time window and a ticket, plan, diff, file or symbol.",
          }),
      ),
    )
    yield* requireAgentAccessProjectId("context_for_change", input.projectId)
    yield* assertHistoryWindow(input.startedAfter, input.startedBefore)
    const family = yield* resolveMcpGrantFamily(identity)
    const reader = mcpDelegatedReader(
      identity,
      family.familyId,
      input.projectId,
    )
    const queries = yield* GetProjectWorkflowData
    const scope = {
      repository: input.repository,
      environment: input.environment,
    }
    const { mappings, truncated } = yield* queries.artifactMappings(
      reader,
      scope,
    )
    const ranked = rankChangeMappings(input, mappings)
    const candidates = yield* Effect.forEach(ranked.candidates, (candidate) =>
      Effect.gen(function* () {
        const { deployment, probe, strength, reason, terms, otherRevision } =
          candidate
        const sampled =
          probe.location.kind === "source"
            ? yield* readCases(
                reader,
                {
                  startedAfter: input.startedAfter,
                  startedBefore: input.startedBefore,
                },
                candidate,
              )
            : { cases: [], total: 0 }
        const ordinary = sampled.cases.find(
          ({ observedShape }) => observedShape === "sampled-execution",
        )
        const contrast = sampled.cases.find(
          (item) =>
            item.observedShape === "multiple-envelopes-for-one-change" ||
            (ordinary !== undefined &&
              (item.outcome !== ordinary.outcome ||
                item.status !== ordinary.status)),
        )
        const examples = [
          ...(ordinary ? [{ ...ordinary, selection: "representative" }] : []),
          ...(contrast ? [{ ...contrast, selection: "contrasting" }] : []),
        ]
        return {
          behaviorId: probe.behaviorId,
          behaviorRevision: probe.behaviorRevision,
          probeId: probe.probeId,
          source:
            probe.location.kind === "ambiguous"
              ? {
                  kind: "ambiguous",
                  candidateCount: probe.location.candidates.length,
                  examples: probe.location.candidates.slice(0, 2),
                }
              : probe.location,
          match: { strength, reason, terms, otherRevision },
          deployment: {
            environment: deployment.environment,
            service: deployment.service,
            revision: deployment.manifest.revision,
            artifactDigest: deployment.manifest.artifactDigest,
            bindingId: deployment.bindingId,
            deploymentId: deployment.deploymentId,
          },
          matchedRuns: sampled.total,
          sampleIncomplete:
            sampled.total > sampled.cases.length ||
            sampled.cases.some(
              ({ evidencePageTruncated }) => evidencePageTruncated,
            ),
          examples,
        }
      }),
    )
    const observedArtifacts = new Set(
      candidates
        .filter(({ matchedRuns }) => matchedRuns > 0)
        .map(({ deployment }) => deployment.artifactDigest),
    )
    return {
      tool: "context_for_change",
      version: input.version,
      projectId: input.projectId,
      scope: {
        ...scope,
        startedAfter: input.startedAfter,
        startedBefore: input.startedBefore,
        revision: input.revision,
      },
      status:
        observedArtifacts.size > 1
          ? "mixed-artifacts"
          : observedArtifacts.size === 1
            ? "observed"
            : "no-observed-cases",
      candidates,
      uncertainty: {
        deploymentScanTruncated: truncated,
        candidateListTruncated: ranked.truncated,
        requestedRevisionSeen:
          input.revision === undefined
            ? null
            : mappings.some(
                ({ manifest }) => manifest.revision === input.revision,
              ),
        description:
          "Mappings identify candidates. Examples are a bounded sample of observed events and do not establish current traffic or the intended behavior.",
      },
    }
  },
  Effect.catchTag("PersistenceError", () =>
    Effect.fail(
      new McpToolReadError({ reason: "Runtime context could not be read." }),
    ),
  ),
)
