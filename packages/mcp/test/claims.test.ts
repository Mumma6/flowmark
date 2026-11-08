import { describe, expect, it } from "vitest"
import { authInfoFromClaims } from "../src/auth/claims.js"
import type { ResolvedAgentAccessRuntime } from "../src/runtime/agent-access-runtime.js"

const runtime = {
  issuerOrigin: "https://studio.example.test",
  mcpResourceUrl: "https://api.example.test/mcp",
} as ResolvedAgentAccessRuntime

describe("verified MCP claims", () => {
  it("rejects tokens without their own grant family", () => {
    expect(
      authInfoFromClaims(runtime, { sub: "user", client_id: "client" }),
    ).toBeUndefined()
    expect(
      authInfoFromClaims(runtime, {
        sub: "user",
        client_id: "client",
        flowmark_grant_family: " ",
      }),
    ).toBeUndefined()
  })
  it("carries the signed family into delegated reads", () => {
    expect(
      authInfoFromClaims(runtime, {
        sub: "user",
        client_id: "client",
        flowmark_grant_family: "family",
      }),
    ).toMatchObject({
      subjectUserId: "user",
      clientId: "client",
      authorizationCodeId: "family",
    })
  })
})
