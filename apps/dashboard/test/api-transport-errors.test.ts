import { describe, expect, it } from "vitest"
import {
  isTrpcResponseBody,
  mapNonTrpcHttpError,
  mapPlainProxyError,
  presentQueryError,
  proxyUnavailableMessage,
  queryForbiddenMessage,
  queryUnauthorizedMessage,
  readDashboardTransportError,
} from "../features/platform/api-transport-errors"

describe("dashboard transport errors", () => {
  it("recognizes tRPC envelopes and plain proxy JSON separately", () => {
    expect(
      isTrpcResponseBody([
        { result: { data: { json: [] } } },
        { error: { json: { message: "Sign in required." } } },
      ]),
    ).toBe(true)
    expect(isTrpcResponseBody({ error: "Flowmark API is unavailable." })).toBe(
      false,
    )
  })

  it("maps a proxy 502 into retry guidance without upstream details", async () => {
    const response = new Response(
      JSON.stringify({ error: "Flowmark API is unavailable." }),
      { status: 502, headers: { "content-type": "application/json" } },
    )
    expect(await readDashboardTransportError(response)).toBe(
      proxyUnavailableMessage,
    )
  })

  it("preserves upstream tRPC error bodies for the client parser", async () => {
    const response = new Response(
      JSON.stringify([
        {
          error: {
            json: {
              message: "Sign in required.",
              code: -32001,
              data: { code: "UNAUTHORIZED" },
            },
          },
        },
      ]),
      { status: 401, headers: { "content-type": "application/json" } },
    )
    expect(await readDashboardTransportError(response)).toBeNull()
  })

  it("maps plain 401/403 JSON into authorization failures", () => {
    expect(mapPlainProxyError(401, "ignored")).toBe(queryUnauthorizedMessage)
    expect(mapPlainProxyError(403, "ignored")).toBe(queryForbiddenMessage)
    expect(mapNonTrpcHttpError(401)).toBe(queryUnauthorizedMessage)
    expect(mapNonTrpcHttpError(403)).toBe(queryForbiddenMessage)
  })

  it("replaces the generic tRPC transform failure in presentation", () => {
    expect(
      presentQueryError(new Error("Unable to transform response from server")),
    ).toBe(proxyUnavailableMessage)
    expect(presentQueryError(new Error("Sign in required."))).toBe(
      "Sign in required.",
    )
  })
})
