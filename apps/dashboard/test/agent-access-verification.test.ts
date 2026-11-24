import { expect, it } from "vitest"
import {
  AgentRead,
  interpretAgentReadVerification,
} from "../features/connect/access/agent-access-verification"

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
  ).toEqual(AgentRead.Authenticated())
})

it("keeps a copied configuration and a failed copy unverified", () => {
  expect(
    AgentRead.$is("WrongProject")(
      interpretAgentReadVerification({
        ...base,
        configurationCopied: true,
      }),
    ),
  ).toBe(true)
  expect(
    AgentRead.$is("CopyFailed")(
      interpretAgentReadVerification({
        ...base,
        configurationCopied: true,
        copyFailed: true,
        connections: "pending",
      }),
    ),
  ).toBe(true)
  expect(
    AgentRead.$is("Granted")(
      interpretAgentReadVerification({
        ...base,
        grants: [{ projectIds: [projectId], lastAuthenticatedAt: null }],
        configurationCopied: true,
      }),
    ),
  ).toBe(true)
})

it("separates a missing grant, a rejected read, and an unavailable service", () => {
  expect(
    AgentRead.$is("WrongProject")(
      interpretAgentReadVerification({
        ...base,
        grants: [
          {
            projectIds: ["00000000-0000-4000-8000-000000000099"],
            lastAuthenticatedAt: "2026-11-08T12:00:00.000Z",
          },
        ],
      }),
    ),
  ).toBe(true)
  expect(
    AgentRead.$is("Denied")(
      interpretAgentReadVerification({ ...base, connections: "unauthorized" }),
    ),
  ).toBe(true)
  expect(
    AgentRead.$is("Unavailable")(
      interpretAgentReadVerification({ ...base, connections: "unavailable" }),
    ),
  ).toBe(true)
  expect(
    AgentRead.$is("UnsupportedClient")(
      interpretAgentReadVerification({ ...base, clientSupported: false }),
    ),
  ).toBe(true)
  expect(
    AgentRead.$is("Unavailable")(
      interpretAgentReadVerification({ ...base, deployment: "unavailable" }),
    ),
  ).toBe(true)
})

it("does not promote a multi-project grant timestamp into project-specific verification", () => {
  const grants = [
    {
      projectIds: [projectId, "00000000-0000-4000-8000-000000000099"],
      lastAuthenticatedAt: "2026-11-08T12:00:00.000Z",
    },
  ]
  expect(interpretAgentReadVerification({ ...base, grants })).toEqual(
    AgentRead.Authenticated(),
  )
  expect(
    interpretAgentReadVerification({
      ...base,
      grants,
      projectId: grants[0]!.projectIds[1],
    }),
  ).toEqual(AgentRead.Authenticated())
  expect(
    interpretAgentReadVerification({
      ...base,
      grants,
      connections: "unauthorized",
    }),
  ).toEqual(AgentRead.Denied())
})
