import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto"
import { RuntimeProbeReferenceSchema } from "@flowmarkdev/core"
import { Effect, Schema } from "effect"
import { GetProjectWorkflowData } from "./get-project-workflow-data.js"
import { User } from "../models/project-reader.js"

const Uuid = Schema.String.check(Schema.isUUID())
const CitationSelection = Schema.Struct({
  projectId: Uuid,
  probe: RuntimeProbeReferenceSchema,
  revision: Schema.String,
  environment: Schema.String,
  startedAfter: Schema.String,
  startedBefore: Schema.String,
  asOf: Schema.Int,
  matchedRuns: Schema.Int,
  sampleIncomplete: Schema.Boolean,
  examples: Schema.Array(
    Schema.Struct({
      runId: Uuid,
      startedAt: Schema.String,
      status: Schema.String,
      outcome: Schema.NullOr(Schema.String),
      selection: Schema.Literals(["representative", "contrasting"]),
      eventIds: Schema.Array(Uuid).check(
        Schema.isMinLength(1),
        Schema.isMaxLength(12),
      ),
    }),
  ).check(Schema.isMinLength(1), Schema.isMaxLength(2)),
})

type CitationSelection = typeof CitationSelection.Type

export const RUNTIME_CITATION_MAX_LENGTH = 8192
const lifetimeMs = 24 * 60 * 60 * 1000
const version = "v1"
const citationKey = (secret: string) =>
  createHmac("sha256", secret).update("flowmark/runtime-citation/v1").digest()

export function sealRuntimeCitation(
  secret: string,
  selection: CitationSelection,
) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", citationKey(secret), nonce)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(selection), "utf8"),
    cipher.final(),
  ])
  return (
    version +
    "." +
    Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url")
  )
}

function openRuntimeCitation(secret: string, handle: string) {
  if (
    handle.length > RUNTIME_CITATION_MAX_LENGTH ||
    !/^v1\.[A-Za-z0-9_-]+$/.test(handle)
  ) {
    return undefined
  }
  const encoded = handle.slice(version.length + 1)
  const data = Buffer.from(encoded, "base64url")
  if (data.length <= 28 || data.toString("base64url") !== encoded) {
    return undefined
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      citationKey(secret),
      data.subarray(0, 12),
    )
    decipher.setAuthTag(data.subarray(12, 28))
    const decoded: unknown = JSON.parse(
      Buffer.concat([
        decipher.update(data.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    )
    return Schema.decodeUnknownSync(CitationSelection)(decoded)
  } catch {
    return undefined
  }
}

export const resolveRuntimeCitation = Effect.fn("resolveRuntimeCitation")(
  function* (userId: string, secret: string, handle: string, now = Date.now()) {
    const selection = openRuntimeCitation(secret, handle)
    if (!selection || selection.asOf + lifetimeMs <= now) {
      return { status: "expired-or-invalid" as const }
    }
    const queries = yield* GetProjectWorkflowData
    const reader = User({
      userId,
      projectId: selection.projectId,
    })
    const pages = yield* Effect.forEach(selection.examples, (example) =>
      queries
        .runEventPage(reader, {
          runId: example.runId,
          eventIds: example.eventIds,
          limit: example.eventIds.length,
          observationsOnly: true,
        })
        .pipe(Effect.catchTag("InvalidInput", () => Effect.succeed(null))),
    )
    const examples = selection.examples.map(
      ({ eventIds, ...example }, index) => {
        const events = pages[index]?.events.flatMap((event) => {
          const runtime = event.runtimeObservation
          const probe = runtime?.observation.probe
          if (
            runtime?.binding.status !== "bound" ||
            probe?.bindingId !== selection.probe.bindingId ||
            probe.deploymentId !== selection.probe.deploymentId ||
            probe.artifactDigest !== selection.probe.artifactDigest ||
            probe.probeId !== selection.probe.probeId
          ) {
            return []
          }
          return [
            {
              id: event.id,
              type: event.type,
              step: event.step,
              timestamp: event.timestamp,
              runtimeObservation: runtime,
            },
          ]
        })
        const ordered = eventIds.map((id) =>
          events?.find((event) => event.id === id),
        )
        return {
          ...example,
          events: ordered.filter((event) => event !== undefined),
        }
      },
    )
    if (
      examples.some(
        ({ events }, index) =>
          events.length !== selection.examples[index]?.eventIds.length,
      )
    ) {
      return { status: "evidence-unavailable" as const }
    }
    return {
      status: "exact" as const,
      asOf: new Date(selection.asOf).toISOString(),
      revision: selection.revision,
      environment: selection.environment,
      probe: selection.probe,
      startedAfter: selection.startedAfter,
      startedBefore: selection.startedBefore,
      matchedRuns: selection.matchedRuns,
      sampleIncomplete: selection.sampleIncomplete,
      examples,
    }
  },
)
