import { Data, Effect, Result, Schema } from "effect"
import {
  evidenceHtml,
  evidenceResourceCsp,
  evidenceResourceUri,
} from "@flowmark/evidence-view/resource"
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
  getUiCapability,
} from "@modelcontextprotocol/ext-apps/server"
import type {
  ClientCapabilities,
  McpServer,
  ToolCallback,
  StandardSchemaWithJSON,
  ToolAnnotations,
} from "@modelcontextprotocol/server"

export const supportsEvidenceView = (
  capabilities: ClientCapabilities | undefined,
) =>
  getUiCapability(capabilities)?.mimeTypes?.includes(RESOURCE_MIME_TYPE) ===
  true

export const evidenceToolMetadata = {
  ui: { resourceUri: evidenceResourceUri, visibility: ["model", "app"] },
}

export function registerEvidenceResource(
  server: McpServer,
  authorize: (signal?: AbortSignal) => Promise<void>,
) {
  return registerAppResource(
    server,
    "Run evidence",
    evidenceResourceUri,
    {
      description:
        "Static read-only run evidence presentation; contains no selected evidence or credentials.",
      _meta: { ui: { csp: evidenceResourceCsp, permissions: {} } },
    },
    async (uri, context) => {
      if (uri.href !== evidenceResourceUri) {
        throw new Error("Unsupported evidence resource.")
      }
      await authorize(context.mcpReq.signal)
      return {
        contents: [
          {
            uri: evidenceResourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: evidenceHtml,
            _meta: { ui: { csp: evidenceResourceCsp, permissions: {} } },
          },
        ],
      }
    },
  )
}

/** Presentation negotiation only. The SDK still validates the original RPC body. */
export function requestSupportsEvidenceView(value: unknown) {
  const result = Schema.decodeUnknownResult(
    Schema.Struct({
      params: Schema.Struct({
        _meta: Schema.Struct({
          "io.modelcontextprotocol/clientCapabilities": Schema.Struct({
            extensions: Schema.Struct({
              "io.modelcontextprotocol/ui": Schema.Struct({
                mimeTypes: Schema.Array(Schema.String),
              }),
            }),
          }),
        }),
      }),
    }),
  )(value)
  return Result.match(result, {
    onFailure: () => false,
    onSuccess: (body) =>
      supportsEvidenceView({
        extensions: {
          "io.modelcontextprotocol/ui": {
            mimeTypes: [
              ...body.params._meta["io.modelcontextprotocol/clientCapabilities"]
                .extensions["io.modelcontextprotocol/ui"].mimeTypes,
            ],
          },
        },
      }),
  })
}

class CapabilityReadError extends Data.TaggedError("CapabilityReadError")<{
  readonly cause: unknown
}> {}
export const readEvidenceCapability = Effect.fn("Mcp.readEvidenceCapability")(
  (request: Request) =>
    Effect.tryPromise({
      try: () => request.clone().json(),
      catch: (cause) => new CapabilityReadError({ cause }),
    }).pipe(
      Effect.map(requestSupportsEvidenceView),
      // Invalid JSON is left to the SDK's original request parser; it never enables UI.
      Effect.catchTag("CapabilityReadError", () => Effect.succeed(false)),
    ),
)

export const registerRunEvidenceTool = (
  server: McpServer,
  config: {
    readonly title: string
    readonly description: string
    readonly inputSchema: StandardSchemaWithJSON
    readonly annotations: ToolAnnotations
  },
  callback: ToolCallback<StandardSchemaWithJSON>,
  uiSupported: boolean,
) =>
  uiSupported
    ? registerAppTool(
        server,
        "get_run",
        { ...config, _meta: evidenceToolMetadata },
        callback,
      )
    : server.registerTool("get_run", config, callback)
