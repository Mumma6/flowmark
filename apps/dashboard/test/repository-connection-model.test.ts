import { describe, expect, it } from "vitest"
import {
  buildRepositoryConnectPayload,
  defaultRepositoryConnectDraft,
  formatAllowedNamespaces,
  installationColdStartSummary,
  installationStatusBadgeVariant,
  installationStatusLabel,
  parseAllowedNamespaces,
} from "../features/connect/repositories/repository-connection-model"

describe("repository connection UI model", () => {
  it("parses and deduplicates kind:namespace entries and defaults bare names to entity", () => {
    const parsed = parseAllowedNamespaces(
      "entity:booking, change:reschedule, booking, entity:booking, invalid:bad",
    )
    expect(parsed).toEqual([
      { kind: "entity", namespace: "booking" },
      { kind: "change", namespace: "reschedule" },
    ])
    expect(formatAllowedNamespaces(parsed)).toBe(
      "entity:booking, change:reschedule",
    )
  })

  it("builds a validated connect payload with narrow writer permissions and raw payloads disabled", () => {
    const result = buildRepositoryConnectPayload(
      "11111111-1111-4111-8111-111111111111",
      {
        ...defaultRepositoryConnectDraft,
        repository: "acme/checkout",
        service: "checkout-api",
        environment: "staging",
        externalInstallationId: "9001",
      },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.host).toBe("github")
      expect(result.payload.runtime).toBe("node")
      expect(result.payload.policy.allowRawPayloads).toBe(false)
      expect(result.payload.policy.retentionDays).toBe(30)
    }
  })

  it("rejects empty namespace lists and invalid repository slugs", () => {
    const noNamespaces = buildRepositoryConnectPayload(
      "11111111-1111-4111-8111-111111111111",
      {
        ...defaultRepositoryConnectDraft,
        repository: "acme/checkout",
        service: "checkout-api",
        externalInstallationId: "9001",
        allowedNamespacesText: "   ",
      },
    )
    expect(noNamespaces.ok).toBe(false)

    const badRepo = buildRepositoryConnectPayload(
      "11111111-1111-4111-8111-111111111111",
      {
        ...defaultRepositoryConnectDraft,
        repository: "not-a-slug",
        service: "checkout-api",
        externalInstallationId: "9001",
      },
    )
    expect(badRepo.ok).toBe(false)
  })

  it("maps installation status and cold-start states cleanly", () => {
    expect(installationStatusLabel("pending-verification")).toBe(
      "Pending verification",
    )
    expect(installationStatusBadgeVariant("active")).toBe("success")
    expect(installationStatusBadgeVariant("revoked")).toBe("destructive")
    expect(installationColdStartSummary("pending-deployment-receipt")).toMatch(
      /deployment/i,
    )
    expect(installationColdStartSummary("pending-eligible-traffic")).toMatch(
      /traffic/i,
    )
  })
})
