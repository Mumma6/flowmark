import { Array, Effect, Result, Schema } from "effect"
import {
  CapturedRunEvidenceSchema,
  type EvidenceCaptureRead,
  type EvidenceCaptureSummary,
} from "@flowmarkdev/core"
import type {
  CaptureAccess,
  CaptureRecord,
} from "../ports/evidence-captures.js"
export const readCapture = Effect.fn("readCapture")(function* (
  projectId: string,
  access: CaptureAccess,
  row: CaptureRecord,
  native: boolean,
) {
  const canDelete =
    native && (access.role === "owner" || access.userId === row.creatorId)
  const payload =
    row.reason === null ? yield* access.payload(row.id) : undefined
  const parsed = Schema.decodeUnknownResult(CapturedRunEvidenceSchema, {
    onExcessProperty: "error",
  })(payload)
  const capture = Result.isSuccess(parsed) ? parsed.success : null
  const valid =
    capture !== null &&
    capture.id === row.id &&
    capture.sourceRunId === row.sourceRunId &&
    capture.creatorId === row.creatorId &&
    capture.projectId === projectId &&
    capture.evidence.projection.publicationRevision === access.revision &&
    capture.capturedAt === new Date(row.capturedAt).toISOString() &&
    capture.expiresAt === new Date(row.expiresAt).toISOString()
  if (valid) {
    return { available: true, capture, canDelete } satisfies EvidenceCaptureRead
  }
  const unavailable: EvidenceCaptureRead = {
    available: false,
    id: row.id,
    capturedAt: new Date(row.capturedAt).toISOString(),
    reason: row.reason ?? "Invalid",
  }
  return canDelete ? unavailable : null
})
export const captureSummary = (
  read: EvidenceCaptureRead,
): EvidenceCaptureSummary =>
  read.available
    ? {
        id: read.capture.id,
        capturedAt: read.capture.capturedAt,
        title: read.capture.title,
        expiresAt: read.capture.expiresAt,
        available: true,
        reason: null,
        canDelete: read.canDelete,
      }
    : {
        id: read.id,
        capturedAt: read.capturedAt,
        title: null,
        expiresAt: null,
        available: false,
        reason: read.reason,
        canDelete: true,
      }
export const visibleCaptures = Effect.fn("visibleCaptures")(function* (
  projectId: string,
  access: CaptureAccess,
  native: boolean,
) {
  const records = yield* access.records()
  const reads = yield* Effect.forEach(records, (row) =>
    readCapture(projectId, access, row, native),
  )
  return Array.filter(
    reads,
    (read): read is EvidenceCaptureRead => read !== null,
  )
})
