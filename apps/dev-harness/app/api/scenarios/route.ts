import { Effect, Result, Schema } from "effect"
import { flowmark } from "../../../lib/flowmark"
import { runBusinessScenario } from "../../../lib/business-scenarios"
import { scenarioIds } from "../../../lib/operations-catalog"

const RequestSchema = Schema.Struct({
  scenario: Schema.Literals(scenarioIds),
})

const decodeScenario = Effect.fn("decodeScenario")(function* (
  request: Request,
) {
  const body = yield* Effect.tryPromise({
    try: () => request.json(),
    catch: () => new Error("invalid-json"),
  })
  return yield* Schema.decodeUnknownEffect(RequestSchema)(body)
})

export async function POST(request: Request) {
  const decoded = await Effect.runPromise(
    Effect.result(decodeScenario(request)),
  )
  return Result.match(decoded, {
    onFailure: () =>
      Response.json(
        { error: "Choose one of the supported operations scenarios." },
        { status: 400 },
      ),
    onSuccess: async ({ scenario }) =>
      Response.json(await runBusinessScenario(flowmark, scenario)),
  })
}
