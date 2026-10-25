import { Either, Schema } from "effect"
import { flowmark } from "../../../lib/flowmark"
import { runBusinessScenario } from "../../../lib/business-scenarios"
import { scenarioIds } from "../../../lib/operations-catalog"

const RequestSchema = Schema.Struct({
  scenario: Schema.Literal(...scenarioIds),
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
  if (Either.isLeft(decoded)) {
    return Response.json(
      { error: "Choose one of the supported operations scenarios." },
      { status: 400 },
    )
  }
  return Response.json(
    await runBusinessScenario(flowmark, decoded.right.scenario),
  )
}
