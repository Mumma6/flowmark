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
}

it("reports connection authentication without claiming a project evidence read", () => {
  expect(
    interpretAgentReadVerification({
      ...base,
      grants: [
        {
          projectIds: [projectId],
          lastAuthenticatedAt: "2026-11-08T12:00:00.000Z",
        },
      ],
    }),
  ).toEqual({ _tag: "Authenticated" })
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
    interpretAgentReadVerification({ ...base, connections: "unauthorized" })
      ._tag,
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

it("does not promote a multi-project grant timestamp into project-specific verification", () => {
  const grants = [
    {
      projectIds: [projectId, "00000000-0000-4000-8000-000000000099"],
      lastAuthenticatedAt: "2026-11-08T12:00:00.000Z",
    },
  ]
  expect(interpretAgentReadVerification({ ...base, grants })).toEqual({
    _tag: "Authenticated",
  })
  expect(
    interpretAgentReadVerification({
      ...base,
      grants,
      projectId: grants[0]!.projectIds[1],
    }),
  ).toEqual({ _tag: "Authenticated" })
  expect(
    interpretAgentReadVerification({
      ...base,
      grants,
      connections: "unauthorized",
    }),
  ).toEqual({ _tag: "Denied" })
})
