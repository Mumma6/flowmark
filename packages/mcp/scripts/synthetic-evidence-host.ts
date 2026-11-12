/** Local-only fixture: never mounted by the application or backed by existing data. */
import { createServer } from "node:http"
import { Readable } from "node:stream"
import {
  createMcpHandler,
  fromJsonSchema,
  McpServer,
} from "@modelcontextprotocol/server"
import { Effect, Match, Schema } from "effect"
import {
  registerEvidenceResource,
  registerRunEvidenceTool,
  readEvidenceCapability,
} from "../src/features/connection/evidence-resource.js"

const projectId = "00000000-0000-4000-8000-000000000001"
const runId = "00000000-0000-4000-8000-000000000002"
const sample = {
  tool: "get_run",
  projectId,
  runId,
  section: "events",
  summary: {
    id: runId,
    workflow: "synthetic.customer-import",
    startedAt: "2026-11-10T09:00:00Z",
    status: "Completed",
    durationMs: 1200,
  },
  page: {
    runId,
    limit: 50,
    totalEvents: 20,
    nextCursor: "synthetic-next-page",
    events: [
      {
        id: "synthetic-start",
        type: "started",
        timestamp: "2026-11-10T09:00:00Z",
      },
      {
        id: "synthetic-progress",
        type: "progress",
        timestamp: "2026-11-10T09:00:01Z",
        properties: { canary: "WITHHELD_SYNTHETIC_PAYLOAD" },
      },
    ],
  },
}
const mode = Schema.decodeUnknownSync(
  Schema.Literals([
    "pages",
    "access-unavailable",
    "unavailable",
    "scope-mismatch",
  ]),
)(process.env.FLOWMARK_SYNTHETIC_EVIDENCE_MODE ?? "pages")
const handler = (supported: boolean) =>
  createMcpHandler(
    () => {
      const server = new McpServer(
        { name: "Flowmark synthetic evidence fixture", version: "0.1.0" },
        { capabilities: { tools: {}, resources: {} } },
      )
      registerRunEvidenceTool(
        server,
        {
          title: "Synthetic run evidence",
          description:
            "Local synthetic fixture; no credentials or existing telemetry.",
          inputSchema: fromJsonSchema({
            type: "object",
            properties: {
              projectId: { type: "string", default: projectId },
              runId: { type: "string", default: runId },
              section: { type: "string", default: "events" },
              cursor: { type: "string" },
              limit: { type: "integer", minimum: 1, maximum: 100 },
            },
            required: ["projectId", "runId"],
            additionalProperties: false,
          }),
          annotations: { readOnlyHint: true, destructiveHint: false },
        },
        async (args) => {
          const value = args as {
            projectId?: string
            runId?: string
            cursor?: string
            limit?: number
          }
          if (value.projectId !== projectId || value.runId !== runId) {
            return {
              isError: true,
              content: [{ type: "text", text: "Unknown synthetic selection." }],
            }
          }
          if (value.cursor && mode !== "pages" && mode !== "scope-mismatch") {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: "Synthetic read denied or unavailable; no existing data.",
                },
              ],
              ...(mode === "access-unavailable"
                ? {
                    _meta: {
                      "io.flowmark/evidence": { state: "access-unavailable" },
                    },
                  }
                : {}),
            }
          }
          const supplied = {
            ...sample,
            projectId:
              value.cursor && mode === "scope-mismatch"
                ? "foreign-project"
                : projectId,
            page: {
              ...sample.page,
              totalEvents: 4,
              limit: value.limit ?? 50,
              nextCursor: value.cursor ? null : "synthetic-next-page",
              events: Match.value(Boolean(value.cursor)).pipe(
                Match.when(true, () => [
                  {
                    id: "synthetic-result",
                    type: "checkpoint",
                    timestamp: "2026-11-10T09:00:01Z",
                  },
                  {
                    id: "synthetic-completed",
                    type: "completed",
                    timestamp: "2026-11-10T09:00:02Z",
                  },
                ]),
                Match.orElse(() => sample.page.events),
              ),
            },
          }
          return {
            content: [{ type: "text", text: JSON.stringify(supplied) }],
            structuredContent: supplied,
          }
        },
        supported,
      )
      registerEvidenceResource(server, async () => {})
      return server
    },
    { legacy: "reject" },
  )
const plain = handler(false),
  app = handler(true)
const server = createServer(async (incoming, outgoing) => {
  const headers = new Headers()
  Object.entries(incoming.headers).forEach(([key, value]) => {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(",") : value)
    }
  })
  const origin = headers.get("origin")
  if (
    origin === "http://localhost:8080" ||
    origin === "http://127.0.0.1:8080"
  ) {
    outgoing.setHeader("access-control-allow-origin", origin)
    outgoing.setHeader(
      "access-control-allow-headers",
      "content-type,authorization,mcp-protocol-version,mcp-session-id,mcp-method,mcp-name",
    )
    outgoing.setHeader(
      "access-control-allow-methods",
      "GET,POST,OPTIONS,DELETE",
    )
  }
  if (incoming.method === "OPTIONS") {
    outgoing.writeHead(204).end()
    return
  }
  if (incoming.url !== "/mcp") {
    outgoing.writeHead(404).end()
    return
  }
  const init: RequestInit & { duplex: "half" } = {
    method: incoming.method,
    headers,
    duplex: "half",
    ...(incoming.method !== "GET" && incoming.method !== "HEAD"
      ? { body: Readable.toWeb(incoming) as ReadableStream<Uint8Array> }
      : {}),
  }
  const request = new Request("http://127.0.0.1:8099/mcp", init)
  const supported = await Effect.runPromise(readEvidenceCapability(request))
  const response = await (supported ? app : plain).fetch(request)
  outgoing.writeHead(response.status, Object.fromEntries(response.headers))
  if (response.body) {
    Readable.fromWeb(
      response.body as import("node:stream/web").ReadableStream,
    ).pipe(outgoing)
  } else {
    outgoing.end()
  }
})
server.listen(8099, "127.0.0.1", () =>
  console.log(`Synthetic MCP fixture (${mode}): http://127.0.0.1:8099/mcp`),
)
const shutdown = () => {
  server.close()
  void plain.close()
  void app.close()
}
process.once("SIGINT", shutdown)
process.once("SIGTERM", shutdown)
