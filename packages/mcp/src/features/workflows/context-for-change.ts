import { readAuthSecret } from "@flowmark/auth"
import { requireAgentAccessProjectId } from "@flowmark/auth/agent-access"
import {
  GetProjectWorkflowData,
  rankChangeMappings,
  sealRuntimeCitation,
  RuntimeQuestionSchema,
  selectQuestionEvidence,
  type AuthorizeAgentRead,
  type DeployedArtifactMapping,
  type ProjectReader,
  type QuestionEvidenceSelection,
  type RuntimeQuestion,
  type SelectedQuestionCase,
} from "@flowmark/api"
import { Array, Effect, Option, Schema } from "effect"
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
  question: Schema.optional(RuntimeQuestionSchema),
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

const deploymentForQuestion = (
  mappings: ReadonlyArray<DeployedArtifactMapping>,
  question: RuntimeQuestion,
  environment: string | undefined,
) =>
  Array.findFirst(mappings, (deployment) => {
    if (
      deployment.manifest.repository !== question.scope.repository ||
      deployment.service !== question.scope.service
    ) {
      return false
    }
    if (environment && deployment.environment !== environment) {
      return false
    }
    return Array.every(
      [question.requestProbe, question.committedReceiptProbe],
      (probeId) =>
        Array.some(
          deployment.manifest.probes,
          (probe) =>
            probe.probeId === probeId &&
            probe.location.kind === "source" &&
            probe.behaviorId === question.behaviorId &&
            probe.behaviorRevision === question.behaviorRevision,
        ),
    )
  })

const questionCitation = (
  issuer: string,
  secret: string,
  projectId: string,
  question: RuntimeQuestion,
  deployment: QuestionEvidenceSelection["deployment"],
  window: { readonly startedAfter: string; readonly startedBefore: string },
  observed: SelectedQuestionCase,
  eligibleRuns: number,
  truncated: boolean,
) =>
  new URL(
    "/runs/citation#" +
      sealRuntimeCitation(secret, {
        projectId,
        probe: {
          bindingId: deployment.bindingId,
          deploymentId: deployment.deploymentId,
          artifactDigest: deployment.manifest.artifactDigest,
          probeId: question.requestProbe,
        },
        revision: deployment.manifest.revision,
        environment: deployment.environment,
        startedAfter: window.startedAfter,
        startedBefore: window.startedBefore,
        asOf: Date.now(),
        matchedRuns: eligibleRuns,
        sampleIncomplete: truncated,
        examples: [
          {
            runId: observed.runId,
            startedAt: observed.startedAt,
            status: observed.status,
            outcome: observed.outcome,
            selection:
              observed.distinction === "same-change"
                ? "representative"
                : "contrasting",
            eventIds: [...observed.eventIds],
          },
        ],
      }),
    issuer,
  ).href

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
    if (
      input.question &&
      input.question.scope.repository !== input.repository
    ) {
      return yield* Effect.fail(
        new McpToolInputError({
          reason:
            "The supplied question repository must match the authorized repository.",
        }),
      )
    }
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
    const citationSecret = yield* readAuthSecret().pipe(
      Effect.mapError(
        () =>
          new McpToolReadError({
            reason: "Runtime citations are not configured.",
          }),
      ),
    )
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
          ...(ordinary
            ? [{ ...ordinary, selection: "representative" as const }]
            : []),
          ...(contrast
            ? [{ ...contrast, selection: "contrasting" as const }]
            : []),
        ]
        const sampleIncomplete =
          sampled.total > sampled.cases.length ||
          sampled.cases.some(
            ({ evidencePageTruncated }) => evidencePageTruncated,
          )
        const citation =
          examples.length === 0
            ? null
            : new URL(
                "/runs/citation#" +
                  sealRuntimeCitation(citationSecret, {
                    projectId: input.projectId,
                    probe: {
                      bindingId: deployment.bindingId,
                      deploymentId: deployment.deploymentId,
                      artifactDigest: deployment.manifest.artifactDigest,
                      probeId: probe.probeId,
                    },
                    revision: deployment.manifest.revision,
                    environment: deployment.environment,
                    startedAfter: input.startedAfter,
                    startedBefore: input.startedBefore,
                    asOf: Date.now(),
                    matchedRuns: sampled.total,
                    sampleIncomplete,
                    examples: examples.map(
                      ({
                        runId,
                        startedAt,
                        status,
                        outcome,
                        selection,
                        eventIds,
                      }) => ({
                        runId,
                        startedAt,
                        status,
                        outcome,
                        selection,
                        eventIds,
                      }),
                    ),
                  }),
                identity.issuer,
              ).href
        return {
          citation,
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
          sampleIncomplete,
          examples,
        }
      }),
    )
    const observedArtifacts = new Set(
      candidates
        .filter(({ matchedRuns }) => matchedRuns > 0)
        .map(({ deployment }) => deployment.artifactDigest),
    )
    let resolvedQuestionEvidence: Record<string, unknown> | null = null
    if (input.question) {
      const question = input.question
      if (question.excludedReason) {
        resolvedQuestionEvidence = {
          questionId: question.id,
          questionRevision: question.revision,
          predicate: question.predicate,
          status: "unavailable",
          choices: question.choices,
          sameChange: null,
          differentChange: null,
          gap: {
            reason: question.excludedReason,
            recommendedAction: "reuse-or-investigate",
          },
          selection: null,
        }
      } else {
        const deployment = deploymentForQuestion(
          mappings,
          question,
          input.environment,
        ).pipe(Option.getOrNull)
        if (!deployment) {
          resolvedQuestionEvidence = {
            questionId: question.id,
            questionRevision: question.revision,
            predicate: question.predicate,
            status: "unavailable",
            choices: question.choices,
            sameChange: null,
            differentChange: null,
            gap: {
              reason: "deployment-receipt-missing",
              recommendedAction: "wait-or-add-observation",
            },
            selection: null,
          }
        } else {
          const selected = yield* selectQuestionEvidence(
            reader,
            {
              startedAfter: input.startedAfter,
              startedBefore: input.startedBefore,
            },
            deployment,
            question,
          ).pipe(
            Effect.catchTags({
              PersistenceError: () =>
                Effect.fail(
                  new McpToolReadError({
                    reason: "Runtime context could not be read.",
                  }),
                ),
              Unauthorized: () =>
                Effect.fail(
                  new McpToolReadError({
                    reason: "Runtime context could not be read.",
                  }),
                ),
              InvalidInput: () =>
                Effect.fail(
                  new McpToolInputError({
                    reason: "Runtime context could not be read.",
                  }),
                ),
            }),
          )
          const attachCitation = (item: SelectedQuestionCase | null) =>
            item === null
              ? null
              : {
                  ...item,
                  selection:
                    item.distinction === "same-change"
                      ? ("supporting" as const)
                      : ("contrary" as const),
                  citation: questionCitation(
                    identity.issuer,
                    citationSecret,
                    input.projectId,
                    question,
                    selected.deployment,
                    {
                      startedAfter: input.startedAfter,
                      startedBefore: input.startedBefore,
                    },
                    item,
                    selected.selection.eligibleRuns,
                    selected.selection.truncated,
                  ),
                }
          resolvedQuestionEvidence = {
            questionId: question.id,
            questionRevision: question.revision,
            predicate: question.predicate,
            status:
              selected.sameChange !== null && selected.differentChange !== null
                ? "answered"
                : selected.sameChange !== null ||
                    selected.differentChange !== null
                  ? "partial"
                  : "unavailable",
            choices: question.choices,
            sameChange: attachCitation(selected.sameChange),
            differentChange: attachCitation(selected.differentChange),
            gap: selected.gap,
            selection: {
              ...selected.selection,
              description:
                "Counts and examples are bounded. They do not establish prevalence or absence across eligible traffic.",
            },
          }
        }
      }
    }
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
      questionEvidence: resolvedQuestionEvidence,
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
  Effect.catchTags({
    PersistenceError: () =>
      Effect.fail(
        new McpToolReadError({ reason: "Runtime context could not be read." }),
      ),
  }),
)
