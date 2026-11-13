import { randomUUID } from "node:crypto"
import { Array, Effect, Schema } from "effect"
import { CapturedRunEvidenceSchema, captureCoverage } from "@flowmarkdev/core"
import { InvalidInput } from "../../../errors.js"
import {
  projectBusinessField,
  projectBusinessSummary,
} from "../../business-evidence/rules/project-run.js"
import {
  decodePublication,
  publicationMeaning,
} from "../../business-evidence/rules/publication.js"
import type { CaptureAccess } from "../ports/evidence-captures.js"
export const buildCapture = Effect.fn("buildCapture")(function* (
  projectId: string,
  access: CaptureAccess,
  input: { readonly runId: string; readonly title: string },
) {
  const source = yield* access.source(input.runId)
  const meaning = publicationMeaning(
    yield* decodePublication(access.publication),
    yield* access.choices(),
  )
  const fields = Array.flatMap(meaning.results, (entry) =>
    entry.workflow === source.workflow &&
    entry.revision === source.definitionRevision
      ? Array.map(entry.fields, (field) => ({
          revision: entry.revision,
          field,
        }))
      : [],
  )
  const keys = Array.flatMap(meaning.references, (entry) =>
    entry.workflow === source.workflow ? entry.keys : [],
  )
  const values = yield* access.values(
    source.id,
    Array.map(fields, (entry) => entry.field.path),
    keys,
  )
  const capturedAt = new Date(source.capturedAt).toISOString()
  const capture = {
    version: 1 as const,
    id: randomUUID(),
    creatorId: access.userId,
    projectId,
    sourceRunId: source.id,
    title: input.title.trim(),
    capturedAt,
    expiresAt: new Date(source.expiresAt).toISOString(),
    coverage: captureCoverage,
    evidence: {
      projection: {
        version: 1 as const,
        depth: "business" as const,
        projectId,
        publicationRevision: access.revision,
        observedAt: capturedAt,
        withheld: [
          "externalIds",
          "unpublishedProperties",
          "unpublishedResults",
          "errors",
          "operations",
          "rawEvents",
          "expectationPayloads",
          "environment",
          "release",
        ],
      },
      data: {
        kind: "run" as const,
        summary: projectBusinessSummary(source),
        fields: Array.map(fields, ({ revision, field }, i) =>
          projectBusinessField(revision, field, values.values[i]),
        ),
        references: Array.filter(
          values.references,
          (entry) => entry.value.length <= 256,
        ),
      },
    },
  }
  return yield* Schema.decodeUnknownEffect(CapturedRunEvidenceSchema, {
    onExcessProperty: "error",
  })(capture).pipe(
    Effect.mapError(
      () =>
        new InvalidInput({
          cause: "Published evidence cannot fit a supported 64 KiB capture.",
        }),
    ),
  )
})
