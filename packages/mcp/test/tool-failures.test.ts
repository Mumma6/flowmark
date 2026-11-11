import { expect, it } from "vitest"
import { Effect } from "effect"
import { Unauthorized } from "@flowmark/api"
import { McpConnectionResolveError, McpToolReadError } from "../src/errors.js"
import { presentMcpTool } from "../src/tools/response.js"

it("marks unverifiable access without exposing private causes or inventing an expiry/revocation reason", async () => {
  const results = await Effect.runPromise(
    Effect.forEach(
      [
        new Unauthorized({ permission: "read" }),
        new McpConnectionResolveError({
          reason: "Connection cannot be verified.",
          cause: new Error("PRIVATE_CAUSE"),
        }),
        new McpToolReadError({
          reason: "Read deadline exceeded.",
          cause: new Error("PRIVATE_CAUSE"),
        }),
      ],
      (error) => presentMcpTool(Effect.fail(error)),
    ),
  )
  expect(results[0]).toMatchObject({
    isError: true,
    _meta: { "io.flowmark/evidence": { state: "access-unavailable" } },
  })
  expect(results[1]).toMatchObject({
    isError: true,
    _meta: { "io.flowmark/evidence": { state: "access-unavailable" } },
  })
  expect(results[2]).toEqual({
    isError: true,
    content: [{ type: "text", text: "Read deadline exceeded." }],
  })
  expect(JSON.stringify(results)).not.toContain("PRIVATE_CAUSE")
})
