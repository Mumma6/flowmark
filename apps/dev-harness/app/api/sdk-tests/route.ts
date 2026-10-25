import { Schema, Either } from "effect"
import { createFlowmark } from "@flowmark/node"
import { createFlowmark as createNextFlowmark } from "@flowmark/node/next"
import { runScenario, scenarioIds } from "../../../lib/sdk-scenarios"

const RequestSchema = Schema.Struct({
  scenario: Schema.Literal(...scenarioIds),
  runtime: Schema.Literal("next", "node"),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    )
  }
  const decoded = Schema.decodeUnknownEither(RequestSchema)(body)
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
