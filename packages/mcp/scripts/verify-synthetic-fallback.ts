/** Local-only public-example verification; never accepts credentials or another destination. */
import { isDeepStrictEqual } from "node:util"
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client"
import { Array, Console, Data, Effect, HashSet, Schema } from "effect"

class FallbackVerificationError extends Data.TaggedError(
  "FallbackVerificationError",
)<{
  readonly operation: string
  readonly cause?: unknown
}> {}
const request = Effect.fn("SyntheticFallback.request")(
  <A>(operation: string, read: () => Promise<A>) =>
    Effect.tryPromise({
      try: read,
      catch: (cause) => new FallbackVerificationError({ operation, cause }),
    }),
)
const check = (valid: boolean, operation: string) =>
  valid
    ? Effect.void
    : Effect.fail(new FallbackVerificationError({ operation }))
const projectId = "00000000-0000-4000-8000-000000000001"
const runId = "00000000-0000-4000-8000-000000000002"
const selection = { projectId, runId, section: "events", limit: 50 }
const envelope = Schema.Struct({
  isError: Schema.optional(Schema.Boolean),
  content: Schema.Array(
    Schema.Struct({ type: Schema.Literal("text"), text: Schema.String }),
  ),
  structuredContent: Schema.Record(Schema.String, Schema.Unknown),
})
const evidence = Schema.Struct({
  tool: Schema.Literal("get_run"),
  projectId: Schema.Literal(projectId),
  runId: Schema.Literal(runId),
  section: Schema.Literal("events"),
  summary: Schema.Struct({
    id: Schema.Literal(runId),
    status: Schema.Literal("Completed"),
  }),
  page: Schema.Struct({
    runId: Schema.Literal(runId),
    events: Schema.Array(Schema.Struct({ id: Schema.String })),
    limit: Schema.Literal(50),
    totalEvents: Schema.Literal(4),
    nextCursor: Schema.NullOr(Schema.String),
  }),
})
const readPage = Effect.fn("SyntheticFallback.readPage")(function* (
  client: Client,
  cursor?: string,
) {
  const raw = yield* request("get_run", () =>
    client.callTool({
      name: "get_run",
      arguments: { ...selection, ...(cursor === undefined ? {} : { cursor }) },
    }),
  )
  const value = yield* Schema.decodeUnknownEffect(envelope)(raw)
  yield* check(
    !value.isError && value.content.length === 1,
    "successful bounded text result",
  )
  const text = yield* Schema.decodeUnknownEffect(
    Schema.fromJsonString(Schema.Unknown),
  )(value.content[0]!.text)
  yield* check(
    isDeepStrictEqual(text, value.structuredContent),
    "complete text/structured parity",
  )
  const page = yield* Schema.decodeUnknownEffect(evidence)(
    value.structuredContent,
  )
  return page.page
})

const verify = Effect.fn("SyntheticFallback.verify")(function* () {
  const client = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new Client(
          { name: "Flowmark synthetic non-UI verifier", version: "1.0.0" },
          {
            capabilities: {},
            versionNegotiation: { mode: { pin: "2026-07-28" } },
          },
        ),
    ),
    (value) => request("close", () => value.close()).pipe(Effect.orDie),
  )
  yield* request("connect", () =>
    client.connect(
      new StreamableHTTPClientTransport(new URL("http://127.0.0.1:8099/mcp")),
    ),
  )
  yield* check(
    client.getServerVersion()?.name === "Flowmark synthetic evidence fixture",
    "expected synthetic fixture",
  )
  const listed = yield* request("tools/list", () => client.listTools())
  const tool = yield* Array.findFirst(
    listed.tools,
    (value) => value.name === "get_run",
  ).pipe(
    Effect.fromOption(
      () => new FallbackVerificationError({ operation: "listed get_run" }),
    ),
  )
  yield* check(
    tool._meta?.ui === undefined,
    "no UI association for a non-UI client",
  )
  const first = yield* readPage(client)
  yield* check(
    first.events.length === 2 && typeof first.nextCursor === "string",
    "initial partial page and continuation cursor",
  )
  const next = yield* readPage(client, first.nextCursor!)
  yield* check(
    next.events.length === 2 && next.nextCursor === null,
    "last continuation page",
  )
  yield* check(
    HashSet.size(
      HashSet.fromIterable(
        Array.map([...first.events, ...next.events], (event) => event.id),
      ),
    ) === 4,
    "distinct inspectable event references",
  )
  yield* Console.log(
    JSON.stringify(
      {
        client: "@modelcontextprotocol/client@2.3.1",
        protocol: "2026-07-28",
        server: client.getServerVersion(),
        uiCapability: false,
        projectId,
        runId,
        pagesRead: 2,
        eventsRead: first.events.length + next.events.length,
        totalEvents: first.totalEvents,
        textStructuredParity: true,
        lastCursor: next.nextCursor,
      },
      null,
      2,
    ),
  )
})

Effect.runPromise(Effect.scoped(verify())).catch((cause: unknown) => {
  console.error(cause)
  process.exitCode = 1
})
