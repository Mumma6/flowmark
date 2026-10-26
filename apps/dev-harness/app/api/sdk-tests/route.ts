import { Effect, Either, Schema } from "effect"
import { createFlowmark } from "@flowmarkdev/node"
import { createFlowmark as createNextFlowmark } from "@flowmarkdev/node/next"
import { runScenario, scenarioIds } from "../../../lib/sdk-scenarios"

const RequestSchema = Schema.Struct({
  scenario: Schema.Literal(...scenarioIds),
  runtime: Schema.Literal("next", "node"),
})

const decodeRequest = Effect.fn("decodeSdkTestRequest")(function* (
  request: Request,
) {
  const body = yield* Effect.tryPromise({
    try: () => request.json(),
    catch: () => new Error("invalid-json"),
  })
  return yield* Schema.decodeUnknown(RequestSchema)(body)
})

export async function POST(request: Request) {
  const decoded = await Effect.runPromise(Effect.either(decodeRequest(request)))
  return Either.match(decoded, {
    onLeft: () =>
      Response.json(
        { error: "Unknown SDK scenario or runtime." },
        { status: 400 },
      ),
    onRight: async ({ scenario, runtime }) => {
      if (runtime === "next") {
        const client = createNextFlowmark({
          apiKey: "fm_diagnostics_write_local_only",
        })
        return Response.json(await runScenario(client, scenario, "next"))
      }
      const client = createFlowmark({
        apiKey: "fm_diagnostics_write_local_only",
      })
      try {
        const result = await runScenario(client, scenario, "node")
        await client.flush()
        return Response.json(result)
      } finally {
        await client.shutdown()
      }
    },
  })
}
