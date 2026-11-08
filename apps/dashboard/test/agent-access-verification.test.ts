import { expect, it } from "vitest"
import { interpretAgentReadVerification } from "../features/connect/agent-access-verification"

const projectId = "00000000-0000-4000-8000-000000000001"
const base = {
  deployment: "enabled" as const,
  clientSupported: true,
  configurationCopied: false,
  copyFailed: false,
  connections: "ready" as const,
  grants: [],
  projectId,
  runs: "unknown" as const,
}

it("verifies an empty project only after a recorded authorized read", () => {
  expect(
    interpretAgentReadVerification({
      ...base,
      grants: [
        {
          projectIds: [projectId],
          lastAuthenticatedAt: "2026-11-08T12:00:00.000Z",
        },
      ],
      runs: "empty",
    }),
  ).toEqual({ _tag: "Verified", runs: "none" })
})

it("keeps a copied configuration and a failed copy unverified", () => {
  expect(
    interpretAgentReadVerification({
      ...base,
      configurationCopied: true,
    })._tag,
  ).toBe("WrongProject")
  expect(
    interpretAgentReadVerification({
      ...base,
      configurationCopied: true,
      copyFailed: true,
      connections: "pending",
    })._tag,
  ).toBe("CopyFailed")
  expect(
    interpretAgentReadVerification({
      ...base,
      grants: [{ projectIds: [projectId], lastAuthenticatedAt: null }],
      configurationCopied: true,
    })._tag,
  ).toBe("Granted")
})

it("separates a missing grant, a rejected read, and an unavailable service", () => {
  expect(
    interpretAgentReadVerification({
      ...base,
      grants: [
        {
          projectIds: ["00000000-0000-4000-8000-000000000099"],
          lastAuthenticatedAt: "2026-11-08T12:00:00.000Z",
        },
      ],
    })._tag,
  ).toBe("WrongProject")
  expect(
    interpretAgentReadVerification({ ...base, runs: "unauthorized" })._tag,
  ).toBe("Denied")
  expect(
    interpretAgentReadVerification({ ...base, connections: "unavailable" })
      ._tag,
  ).toBe("Unavailable")
  expect(
    interpretAgentReadVerification({ ...base, clientSupported: false })._tag,
  ).toBe("UnsupportedClient")
  expect(
    interpretAgentReadVerification({ ...base, deployment: "disabled" })._tag,
  ).toBe("Disabled")
})
