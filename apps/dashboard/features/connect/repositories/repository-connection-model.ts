import { Array as EffectArray, Match, pipe, Result, Schema } from "effect"
import {
  bootstrapBranchName,
  describeColdStartState,
  RepositoryInstallationCreateSchema,
  type RepositoryAllowedNamespace,
  type RepositoryColdStartStatus,
  type RepositoryInstallationCreate,
  type RepositoryInstallationStatus,
} from "@flowmarkdev/core"

export interface RepositoryConnectFormDraft {
  readonly repository: string
  readonly service: string
  readonly environment: string
  readonly externalInstallationId: string
  readonly allowedNamespacesText: string
  readonly retentionDays: string
  readonly maxOverheadMs: string
  readonly maxEventsPerMinute: string
}

export const defaultRepositoryConnectDraft: RepositoryConnectFormDraft = {
  repository: "",
  service: "",
  environment: "staging",
  externalInstallationId: "",
  allowedNamespacesText: "entity:order, change:checkout",
  retentionDays: "30",
  maxOverheadMs: "10",
  maxEventsPerMinute: "600",
}

const VALID_KINDS = new Set(["entity", "change", "actor", "external"])

const parseSingleNamespace = (
  entry: string,
): RepositoryAllowedNamespace | null => {
  const trimmed = entry.trim()
  if (trimmed.length === 0) {
    return null
  }
  const colonIndex = trimmed.indexOf(":")
  if (colonIndex === -1) {
    return { kind: "entity", namespace: trimmed }
  }
  const kind = trimmed.slice(0, colonIndex).trim()
  const namespace = trimmed.slice(colonIndex + 1).trim()
  if (!VALID_KINDS.has(kind) || namespace.length === 0) {
    return null
  }
  return {
    kind: kind as RepositoryAllowedNamespace["kind"],
    namespace,
  }
}

export function parseAllowedNamespaces(
  raw: string,
): readonly RepositoryAllowedNamespace[] {
  const parsed = pipe(
    raw.split(/[\n,]+/),
    EffectArray.filterMap((segment) => {
      const item = parseSingleNamespace(segment)
      return item ? Result.succeed(item) : Result.failVoid
    }),
  )
  return EffectArray.dedupeWith(
    parsed,
    (left, right) =>
      left.kind === right.kind && left.namespace === right.namespace,
  )
}

export function formatAllowedNamespaces(
  namespaces: readonly RepositoryAllowedNamespace[],
): string {
  return EffectArray.map(
    namespaces,
    (entry) => `${entry.kind}:${entry.namespace}`,
  ).join(", ")
}

export function installationStatusLabel(
  status: RepositoryInstallationStatus,
): string {
  return Match.value(status).pipe(
    Match.when("active", () => "Active"),
    Match.when("pending-verification", () => "Pending verification"),
    Match.when("revoked", () => "Revoked"),
    Match.exhaustive,
  )
}

export function installationStatusBadgeVariant(
  status: RepositoryInstallationStatus,
): "success" | "secondary" | "destructive" {
  return Match.value(status).pipe(
    Match.when("active", () => "success" as const),
    Match.when("pending-verification", () => "secondary" as const),
    Match.when("revoked", () => "destructive" as const),
    Match.exhaustive,
  )
}

export function installationColdStartSummary(
  coldStartStatus: RepositoryColdStartStatus,
): string {
  return describeColdStartState(coldStartStatus).pending
}

export function installationBootstrapBranch(
  service: string,
  environment: string,
): string {
  return bootstrapBranchName(service, environment)
}

export type BuildConnectPayloadResult =
  | { readonly ok: true; readonly payload: RepositoryInstallationCreate }
  | { readonly ok: false; readonly error: string }

export function buildRepositoryConnectPayload(
  projectId: string,
  draft: RepositoryConnectFormDraft,
): BuildConnectPayloadResult {
  const allowedNamespaces = parseAllowedNamespaces(draft.allowedNamespacesText)
  if (allowedNamespaces.length === 0) {
    return {
      ok: false,
      error:
        "Add at least one allowed reference namespace (for example entity:order or change:checkout).",
    }
  }
  const retentionDays = Number.parseInt(draft.retentionDays, 10)
  const maxOverheadMs = Number.parseInt(draft.maxOverheadMs, 10)
  const maxEventsPerMinute = Number.parseInt(draft.maxEventsPerMinute, 10)

  const candidate = {
    projectId,
    host: "github" as const,
    runtime: "node" as const,
    repository: draft.repository.trim(),
    service: draft.service.trim(),
    environment: draft.environment.trim(),
    externalInstallationId: draft.externalInstallationId.trim(),
    policy: {
      allowedNamespaces,
      retentionDays,
      maxEventBytes: 16_384,
      maxOverheadMs,
      maxEventsPerMinute,
      allowRawPayloads: false as const,
    },
  }

  return Result.match(
    Schema.decodeUnknownResult(RepositoryInstallationCreateSchema)(candidate),
    {
      onSuccess: (payload) => ({ ok: true as const, payload }),
      onFailure: () => ({
        ok: false as const,
        error:
          "Check repository (owner/repo), service, environment, GitHub installation ID, and numeric policy bounds.",
      }),
    },
  )
}
