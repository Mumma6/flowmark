import { describe, expect, it, vi } from "vitest"
import {
  createMcpHandler,
  fromJsonSchema,
  McpServer,
} from "@modelcontextprotocol/server"
import {
  requestSupportsEvidenceView,
  registerEvidenceResource,
  registerRunEvidenceTool,
} from "../src/features/connection/evidence-resource.js"
import { evidenceResourceUri } from "@flowmark/evidence-view/resource"

const capabilities = {
  extensions: {
    "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] },
  },
}
const rpc = (method: string, params: Record<string, unknown> = {}) =>
  new Request("http://127.0.0.1/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": method,
      ...(typeof (params.name ?? params.uri) === "string"
        ? { "mcp-name": String(params.name ?? params.uri) }
        : {}),
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...(params as Record<string, unknown>),
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientCapabilities": capabilities,
          "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
        },
      },
    }),
  })

describe("MCP App resource boundary", () => {
  it("negotiates only a valid advertised UI MIME type", () => {
    expect(
      requestSupportsEvidenceView({
        params: {
          _meta: { "io.modelcontextprotocol/clientCapabilities": capabilities },
        },
      }),
    ).toBe(true)
    expect(requestSupportsEvidenceView({})).toBe(false)
    expect(
      requestSupportsEvidenceView({
        params: {
          _meta: {
            "io.modelcontextprotocol/clientCapabilities": {
              extensions: {
                "io.modelcontextprotocol/ui": {
                  mimeTypes: "text/html;profile=mcp-app",
                },
              },
            },
          },
        },
      }),
    ).toBe(false)
  })
  it.each([false, true])(
    "preserves complete fallback and links a UI only when negotiated (%s)",
    async (supported) => {
      const value = {
        projectId: "project",
        runId: "run",
        nextCursor: "next",
        omissions: ["bounded page"],
      }
      const handler = createMcpHandler(
        () => {
          const server = new McpServer({ name: "test", version: "1" })
          registerRunEvidenceTool(
            server,
            {
              title: "run",
              description: "run",
              inputSchema: fromJsonSchema({ type: "object" }),
              annotations: { readOnlyHint: true },
            },
            async () => ({
              content: [{ type: "text", text: JSON.stringify(value) }],
              structuredContent: value,
            }),
            supported,
          )
          return server
        },
        { legacy: "reject" },
      )
      const listed = await (await handler.fetch(rpc("tools/list"))).json()
      expect(listed.error).toBeUndefined()
      expect(listed.result.tools[0]._meta?.ui?.resourceUri).toBe(
        supported ? evidenceResourceUri : undefined,
      )
      expect(listed.result.tools[0]._meta?.ui?.visibility).toEqual(
        supported ? ["model", "app"] : undefined,
      )
      expect(listed.result.tools).toHaveLength(1)
      const result = await (
        await handler.fetch(
          rpc("tools/call", { name: "get_run", arguments: {} }),
        )
      ).json()
      expect(result.result.structuredContent).toEqual(value)
      expect(JSON.parse(result.result.content[0].text)).toEqual(value)
      await handler.close()
    },
  )
  it("checks admission on every resource read and rejects other URIs and denied grants", async () => {
    const authorize = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const handler = createMcpHandler(
      () => {
        const server = new McpServer({ name: "test", version: "1" })
        registerEvidenceResource(server, authorize)
        return server
      },
      { legacy: "reject" },
    )
    const first = await (
      await handler.fetch(rpc("resources/read", { uri: evidenceResourceUri }))
    ).json()
    expect(first.error).toBeUndefined()
    expect(first.result.contents[0].text).toContain("Flowmark run evidence")
    expect(first.result.contents[0]._meta.ui.csp.connectDomains).toEqual([])
    expect(authorize).toHaveBeenCalledTimes(1)
    authorize.mockRejectedValue(new Error("private failure canary"))
    const denied = await (
      await handler.fetch(rpc("resources/read", { uri: evidenceResourceUri }))
    ).json()
    expect(denied.error).toBeDefined()
    const foreign = await (
      await handler.fetch(
        rpc("resources/read", {
          uri: evidenceResourceUri + "?projectId=foreign",
        }),
      )
    ).json()
    expect(foreign.error).toBeDefined()
    expect(authorize).toHaveBeenCalledTimes(2)
    await handler.close()
  })
})
