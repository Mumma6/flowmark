import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  RepositoryCollectionPolicySchema,
  RepositoryInstallationCreateSchema,
  RepositoryInstallationEventSchema,
  buildNodeBootstrapPrPlan,
  containsSecretMaterial,
  evaluateWriterPermissions,
} from "../src/repository-installation.js"

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

describe("repository installation core contract", () => {
  it("validates policy bounds and rejects raw payload escalation or duplicate namespaces", () => {
    expect(
      Schema.decodeUnknownSync(RepositoryCollectionPolicySchema)(policy),
    ).toEqual(policy)
    expect(() =>
      Schema.decodeUnknownSync(RepositoryCollectionPolicySchema)({
        ...policy,
        allowRawPayloads: true,
      }),
    ).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(RepositoryCollectionPolicySchema)({
        ...policy,
        allowedNamespaces: [
          { kind: "change", namespace: "reschedule" },
          { kind: "change", namespace: "reschedule" },
        ],
      }),
    ).toThrow()
  })

  it("enforces narrow PR writer permissions and rejects merge or admin escalation", () => {
    expect(
      evaluateWriterPermissions({
        contents: "write",
        pullRequests: "write",
        metadata: "read",
      }),
    ).toEqual({ status: "allowed" })
    expect(
      evaluateWriterPermissions({
        contents: "read",
        pullRequests: "write",
        metadata: "read",
      }),
    ).toEqual({ status: "grant-narrowed", missing: ["contents:write"] })
    expect(
      evaluateWriterPermissions({
        contents: "write",
        pullRequests: "write",
        metadata: "read",
        canMerge: true,
      }),
    ).toEqual({
      status: "policy-escalation-rejected",
      excess: ["merge"],
    })
    expect(
      evaluateWriterPermissions({
        contents: "write",
        pullRequests: "write",
        metadata: "read",
        administration: "write",
      }),
    ).toEqual({
      status: "policy-escalation-rejected",
      excess: ["administration:write"],
    })
  })

  it("builds a deterministic secret-free Node bootstrap PR plan with explicit cold-start status", () => {
    const plan = buildNodeBootstrapPrPlan({
      projectId: "00000000-0000-4000-8000-000000000001",
      installationId: "00000000-0000-4000-8000-000000000002",
      bindingId: "00000000-0000-4000-8000-000000000003",
      repository: "example/bookings",
      service: "worker",
      environment: "production",
      policy,
      coldStartStatus: "pending-deployment-receipt",
      apiOrigin: "https://api.flowmark.dev",
      mcpOrigin: "https://api.flowmark.dev/mcp",
    })
    expect(plan.branch).toBe("flowmark/connect-worker-production")
    expect(plan.files.map((file) => file.path)).toEqual([
      ".flowmark/install.json",
      ".cursor/rules/flowmark-runtime-memory.mdc",
      "AGENTS.md",
      "src/flowmark/runtime-memory.ts",
      "scripts/flowmark-manifest.mjs",
      "test/flowmark-bootstrap.test.ts",
    ])
    const combined = [
      plan.title,
      plan.body,
      ...plan.files.map((f) => f.content),
    ].join("\n")
    expect(containsSecretMaterial(combined)).toBe(false)
    expect(combined).toContain("FLOWMARK_API_KEY")
    expect(combined).toContain("FLOWMARK_DEPLOYMENT_TOKEN")
    expect(combined).toContain("Awaiting first deployment receipt")
    expect(combined).toContain("context_for_change")
    expect(containsSecretMaterial(`token fmd_${"a".repeat(64)}`)).toBe(true)
    expect(
      containsSecretMaterial("leaked-secret-value-1234", [
        "leaked-secret-value-1234",
      ]),
    ).toBe(true)
  })

  it("decodes create and webhook delivery inputs strictly", () => {
    const create = Schema.decodeUnknownSync(RepositoryInstallationCreateSchema)(
      {
        projectId: "00000000-0000-4000-8000-000000000001",
        host: "github",
        runtime: "node",
        repository: "example/bookings",
        service: "worker",
        environment: "production",
        externalInstallationId: "inst-101",
        policy,
      },
    )
    expect(create.repository).toBe("example/bookings")
    const event = Schema.decodeUnknownSync(RepositoryInstallationEventSchema)({
      deliveryId: "deliv-1",
      sentAt: "2026-11-23T12:00:00.000Z",
      host: "github",
      externalInstallationId: "inst-101",
      repository: "example/bookings",
      action: "created",
      repositories: ["example/bookings"],
      permissions: {
        contents: "write",
        pullRequests: "write",
        metadata: "read",
      },
    })
    expect(event.action).toBe("created")
  })
})
