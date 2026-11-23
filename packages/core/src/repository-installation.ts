import { Array, HashSet, Match, Schema } from "effect"
import { ArtifactManifestSchema } from "./artifact-manifest.js"
import {
  RuntimeProbeReferenceSchema,
  RuntimeReferenceKindSchema,
  RuntimeReferenceNamespaceSchema,
} from "./runtime-observation.js"

const Uuid = Schema.String.check(Schema.isUUID())
const RepositorySlug = Schema.String.check(
  Schema.isPattern(
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,38}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/,
  ),
)
const ScopeName = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/),
)
const ExternalInstallationId = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/),
)
const DeliveryId = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/),
)
const IsoTimestamp = Schema.String.check(
  Schema.isMinLength(20),
  Schema.isMaxLength(40),
  Schema.makeFilter((value) => Number.isFinite(Date.parse(value))),
)
const BoundedUrl = Schema.String.check(
  Schema.isMinLength(8),
  Schema.isMaxLength(256),
  Schema.makeFilter((value) => {
    try {
      const parsed = new URL(value)
      return parsed.protocol === "https:" || parsed.protocol === "http:"
    } catch {
      return false
    }
  }),
)

export const RepositoryHostSchema = Schema.Literal("github")
export type RepositoryHost = typeof RepositoryHostSchema.Type

export const RepositoryRuntimeSchema = Schema.Literal("node")
export type RepositoryRuntime = typeof RepositoryRuntimeSchema.Type

export const RepositoryAllowedNamespaceSchema = Schema.Struct({
  kind: RuntimeReferenceKindSchema,
  namespace: RuntimeReferenceNamespaceSchema,
})
export type RepositoryAllowedNamespace =
  typeof RepositoryAllowedNamespaceSchema.Type

export const RepositoryCollectionPolicySchema = Schema.Struct({
  allowedNamespaces: Schema.Array(RepositoryAllowedNamespaceSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(12),
    Schema.makeFilter((entries) => {
      const keys = HashSet.fromIterable(
        Array.map(entries, (entry) => `${entry.kind}:${entry.namespace}`),
      )
      return HashSet.size(keys) === entries.length
    }),
  ),
  retentionDays: Schema.Int.check(
    Schema.isBetween({ minimum: 1, maximum: 90 }),
  ),
  maxEventBytes: Schema.Int.check(
    Schema.isBetween({ minimum: 1024, maximum: 65_536 }),
  ),
  maxOverheadMs: Schema.Int.check(
    Schema.isBetween({ minimum: 1, maximum: 100 }),
  ),
  maxEventsPerMinute: Schema.Int.check(
    Schema.isBetween({ minimum: 1, maximum: 10_000 }),
  ),
  allowRawPayloads: Schema.Literal(false),
})
export type RepositoryCollectionPolicy =
  typeof RepositoryCollectionPolicySchema.Type

export const RepositoryInstallationStatusSchema = Schema.Literals([
  "pending-verification",
  "active",
  "revoked",
])
export type RepositoryInstallationStatus =
  typeof RepositoryInstallationStatusSchema.Type

export const RepositoryColdStartStatusSchema = Schema.Literals([
  "pending-deployment-receipt",
  "pending-eligible-traffic",
  "verified-disposable-read",
])
export type RepositoryColdStartStatus =
  typeof RepositoryColdStartStatusSchema.Type

const PermissionLevel = Schema.Literals(["none", "read", "write"])

export const RepositoryWriterPermissionGrantSchema = Schema.Struct({
  contents: PermissionLevel,
  pullRequests: PermissionLevel,
  metadata: Schema.Literals(["none", "read"]),
  administration: Schema.optional(PermissionLevel),
  canMerge: Schema.optional(Schema.Boolean),
})
export type RepositoryWriterPermissionGrant =
  typeof RepositoryWriterPermissionGrantSchema.Type

export const DelegatedGrantLinkSchema = Schema.Struct({
  authorizationCodeId: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128),
  ),
  clientId: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
})
export type DelegatedGrantLink = typeof DelegatedGrantLinkSchema.Type

export const RepositoryInstallationCreateSchema = Schema.Struct({
  projectId: Uuid,
  host: RepositoryHostSchema,
  runtime: RepositoryRuntimeSchema,
  repository: RepositorySlug,
  service: ScopeName,
  environment: ScopeName,
  externalInstallationId: ExternalInstallationId,
  policy: RepositoryCollectionPolicySchema,
  delegatedGrantFamily: Schema.optional(DelegatedGrantLinkSchema),
})
export type RepositoryInstallationCreate =
  typeof RepositoryInstallationCreateSchema.Type

export const RepositoryInstallationRevokeSchema = Schema.Struct({
  projectId: Uuid,
  installationId: Uuid,
})
export type RepositoryInstallationRevoke =
  typeof RepositoryInstallationRevokeSchema.Type

export const RepositoryInstallationEventSchema = Schema.Struct({
  deliveryId: DeliveryId,
  sentAt: IsoTimestamp,
  host: RepositoryHostSchema,
  externalInstallationId: ExternalInstallationId,
  repository: RepositorySlug,
  action: Schema.Literals([
    "created",
    "updated",
    "repositories_removed",
    "deleted",
    "suspend",
  ]),
  repositories: Schema.Array(RepositorySlug).check(Schema.isMaxLength(200)),
  permissions: RepositoryWriterPermissionGrantSchema,
})
export type RepositoryInstallationEvent =
  typeof RepositoryInstallationEventSchema.Type

export const RepositoryInstallationBootstrapInputSchema = Schema.Struct({
  projectId: Uuid,
  installationId: Uuid,
  apiOrigin: BoundedUrl,
  mcpOrigin: Schema.optional(BoundedUrl),
  permissions: RepositoryWriterPermissionGrantSchema,
})
export type RepositoryInstallationBootstrapInput =
  typeof RepositoryInstallationBootstrapInputSchema.Type

export const RepositoryInstallationVerifyReadbackSchema = Schema.Struct({
  projectId: Uuid,
  installationId: Uuid,
  runId: Uuid,
  deploymentId: RuntimeProbeReferenceSchema.fields.deploymentId,
  artifactDigest: ArtifactManifestSchema.fields.artifactDigest,
  probeId: RuntimeProbeReferenceSchema.fields.probeId,
})
export type RepositoryInstallationVerifyReadback =
  typeof RepositoryInstallationVerifyReadbackSchema.Type

export type WriterPermissionEvaluation =
  | { readonly status: "allowed" }
  | { readonly status: "grant-narrowed"; readonly missing: readonly string[] }
  | {
      readonly status: "policy-escalation-rejected"
      readonly excess: readonly string[]
    }

/**
 * Enforce narrow PR-writer authority: may write branches and open/update PRs only.
 * Cannot merge, administer repositories, read runtime payloads, or escalate collection policy.
 */
export function evaluateWriterPermissions(
  grant: RepositoryWriterPermissionGrant,
): WriterPermissionEvaluation {
  const excess = Array.filter(
    [
      grant.canMerge === true ? "merge" : "",
      grant.administration && grant.administration !== "none"
        ? `administration:${grant.administration}`
        : "",
    ],
    (item) => item.length > 0,
  )
  if (excess.length > 0) {
    return { status: "policy-escalation-rejected", excess }
  }
  const missing = Array.filter(
    [
      grant.contents !== "write" ? "contents:write" : "",
      grant.pullRequests !== "write" ? "pullRequests:write" : "",
      grant.metadata !== "read" ? "metadata:read" : "",
    ],
    (item) => item.length > 0,
  )
  if (missing.length > 0) {
    return { status: "grant-narrowed", missing }
  }
  return { status: "allowed" }
}

export const SECRET_MATERIAL_PATTERNS = [
  /\bfmk_[a-zA-Z0-9_-]{12,}\b/,
  /\bfmd_[a-f0-9]{16,}\b/,
  /\bfmw_[a-zA-Z0-9_-]{12,}\b/,
  /\bfmr_[a-zA-Z0-9_-]{12,}\b/,
  /\bgh[psou]_[a-zA-Z0-9]{16,}\b/,
  /\bgithub_pat_[a-zA-Z0-9_]{20,}\b/,
  /Bearer\s+[a-zA-Z0-9._-]{16,}/,
  /BEGIN [A-Z ]*PRIVATE KEY/,
] as const

export function containsSecretMaterial(
  content: string,
  extraSecrets: ReadonlyArray<string> = [],
): boolean {
  const matchesPattern = Array.some(SECRET_MATERIAL_PATTERNS, (pattern) =>
    pattern.test(content),
  )
  if (matchesPattern) {
    return true
  }
  return Array.some(
    extraSecrets,
    (secret) => secret.length >= 8 && content.includes(secret),
  )
}

export function bootstrapBranchName(service: string, environment: string) {
  return `flowmark/connect-${service}-${environment}`
}

export function describeColdStartState(status: RepositoryColdStartStatus) {
  return Match.value(status).pipe(
    Match.when("pending-deployment-receipt", () => ({
      readyForLiveTraffic: false,
      pending:
        "Awaiting first deployment receipt (POST /v1/deployments) and disposable verification readback.",
    })),
    Match.when("pending-eligible-traffic", () => ({
      readyForLiveTraffic: false,
      pending:
        "Disposable readback verified. Awaiting eligible deployed traffic in the bound environment.",
    })),
    Match.when("verified-disposable-read", () => ({
      readyForLiveTraffic: false,
      pending:
        "Disposable readback verified. Awaiting first deployed receipt and eligible live traffic.",
    })),
    Match.exhaustive,
  )
}

export type BootstrapPullRequestFile = Readonly<{
  readonly path: string
  readonly content: string
}>

export type BootstrapPullRequestPlan = Readonly<{
  readonly branch: string
  readonly title: string
  readonly body: string
  readonly files: ReadonlyArray<BootstrapPullRequestFile>
}>

export function buildNodeBootstrapPrPlan(input: {
  readonly projectId: string
  readonly installationId: string
  readonly bindingId: string
  readonly repository: string
  readonly service: string
  readonly environment: string
  readonly policy: RepositoryCollectionPolicy
  readonly coldStartStatus: RepositoryColdStartStatus
  readonly apiOrigin: string
  readonly mcpOrigin: string
}): BootstrapPullRequestPlan {
  const branch = bootstrapBranchName(input.service, input.environment)
  const coldStart = describeColdStartState(input.coldStartStatus)
  const config = {
    version: 1,
    host: "github",
    runtime: "node",
    projectId: input.projectId,
    installationId: input.installationId,
    bindingId: input.bindingId,
    repository: input.repository,
    service: input.service,
    environment: input.environment,
    apiOrigin: input.apiOrigin,
    mcpOrigin: input.mcpOrigin,
    policy: input.policy,
    authorities: {
      delegatedEvidenceRead: "mcp-oauth-or-read-key",
      repositoryPrWriter: "github-installation-pr-only",
      deploymentAttestation: "deployment-binding-token",
      ingestion: "server-write-key",
    },
    secretEnvironmentVariables: {
      ingestionWriteKey: "FLOWMARK_API_KEY",
      referenceHmacKey: "FLOWMARK_REFERENCE_KEY",
      deploymentAttestationToken: "FLOWMARK_DEPLOYMENT_TOKEN",
    },
    coldStart: {
      status: input.coldStartStatus,
      pending: coldStart.pending,
    },
  }
  const namespacesLiteral = JSON.stringify(
    input.policy.allowedNamespaces,
    null,
    2,
  )
  const runtimeMemorySource = `import {
  createFlowmark,
  createRuntimeObservationEmitter,
} from "@flowmarkdev/node"

const allowedNamespaces = ${namespacesLiteral} as const

export const flowmark = createFlowmark()

export function createServiceObservationEmitter(probeId: string) {
  const referenceKey = process.env.FLOWMARK_REFERENCE_KEY
  const deploymentId = process.env.FLOWMARK_DEPLOYMENT_ID
  const artifactDigest = process.env.FLOWMARK_ARTIFACT_DIGEST
  if (!referenceKey || !deploymentId || !artifactDigest) {
    return createRuntimeObservationEmitter({
      enabled: false,
      key: "0".repeat(32),
      namespaces: [...allowedNamespaces],
      probe: {
        bindingId: ${JSON.stringify(input.bindingId)},
        deploymentId: "unconfigured",
        artifactDigest: "sha256:${"0".repeat(64)}",
        probeId,
      },
    })
  }
  return createRuntimeObservationEmitter({
    key: referenceKey,
    namespaces: [...allowedNamespaces],
    probe: {
      bindingId: ${JSON.stringify(input.bindingId)},
      deploymentId,
      artifactDigest,
      probeId,
    },
  })
}
`
  const manifestScript = `import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { createArtifactManifest } from "@flowmarkdev/core"

const [artifactPath, probesPath, revision] = process.argv.slice(2)
if (!artifactPath || !probesPath || !revision) {
  console.error("Usage: node scripts/flowmark-manifest.mjs <artifact> <probes.json> <git-sha>")
  process.exit(1)
}
const artifactDigest = \`sha256:\${createHash("sha256").update(readFileSync(artifactPath)).digest("hex")}\`
const probes = JSON.parse(readFileSync(probesPath, "utf8"))
const manifest = createArtifactManifest({
  version: 1,
  repository: ${JSON.stringify(input.repository)},
  revision,
  artifactDigest,
  probes,
})
console.log(JSON.stringify({ bindingId: ${JSON.stringify(input.bindingId)}, manifest }, null, 2))
`
  const bootstrapTest = `// Disposable bootstrap verification checklist for ${input.repository} (${input.service} / ${input.environment}).
// 1. Supply FLOWMARK_API_KEY (ingestion) and FLOWMARK_REFERENCE_KEY in the test environment only.
// 2. Post the built manifest to ${input.apiOrigin}/v1/deployments using FLOWMARK_DEPLOYMENT_TOKEN.
// 3. Run one permitted observation using createServiceObservationEmitter("bootstrap.probe") and drain flowmark.shutdown().
// 4. Verify persisted readback with a separate diagnostic read identity (MCP or read key), never with the PR writer.
export const flowmarkBootstrapTarget = ${JSON.stringify(
    {
      bindingId: input.bindingId,
      repository: input.repository,
      service: input.service,
      environment: input.environment,
      allowedNamespaces: input.policy.allowedNamespaces,
      coldStart: coldStart.pending,
    },
    null,
    2,
  )} as const
`
  const title = `chore(flowmark): connect ${input.service} (${input.environment}) under runtime policy`
  const body = [
    `## Flowmark repository installation`,
    ``,
    `Connects **${input.repository}** (\`${input.service}\` / \`${input.environment}\`) for Node.js runtime memory under owner-approved policy.`,
    ``,
    `### Policy bounds`,
    `- Allowed reference namespaces: ${Array.map(
      input.policy.allowedNamespaces,
      (item) => `\`${item.kind}:${item.namespace}\``,
    ).join(", ")}`,
    `- Retention: ${input.policy.retentionDays} days · Max event bytes: ${input.policy.maxEventBytes} · Max overhead: ${input.policy.maxOverheadMs} ms · Raw payloads: disabled`,
    ``,
    `### Authority separation`,
    `- **Repository PR writer**: branches and PRs only; cannot merge, read protected runtime payloads, or escalate collection policy.`,
    `- **Deployment attestation**: store \`FLOWMARK_DEPLOYMENT_TOKEN\` in your deploy secret store for \`POST /v1/deployments\` (binding \`${input.bindingId}\`).`,
    `- **Ingestion**: store \`FLOWMARK_API_KEY\` and \`FLOWMARK_REFERENCE_KEY\` in server runtime secrets only.`,
    `- **Delegated evidence reads**: connect coding agents via MCP at \`${input.mcpOrigin}\` under a separate read grant.`,
    ``,
    `### Cold-start status`,
    `${coldStart.pending}`,
    ``,
    `No secret values are included in this pull request.`,
  ].join("\n")

  return {
    branch,
    title,
    body,
    files: [
      {
        path: ".flowmark/install.json",
        content: `${JSON.stringify(config, null, 2)}\n`,
      },
      {
        path: "src/flowmark/runtime-memory.ts",
        content: runtimeMemorySource,
      },
      {
        path: "scripts/flowmark-manifest.mjs",
        content: manifestScript,
      },
      {
        path: "test/flowmark-bootstrap.test.ts",
        content: bootstrapTest,
      },
    ],
  }
}
