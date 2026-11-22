import { Deployments, logFailure, runApi } from "@flowmark/api"
import { Effect, Exit } from "effect"
import { readJsonBody } from "../../../src/adapters/request-body"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const operation = Effect.gen(function* () {
    const deployments = yield* Deployments
    const result = yield* deployments.record(
      request.headers.get("authorization"),
      readJsonBody(request),
    )
    if (result.status === "conflict") {
      return Response.json(
        { error: "Deployment ID already has different evidence." },
        { status: 409 },
      )
    }
    return Response.json(result.receipt, {
      headers: { "cache-control": "no-store" },
    })
  }).pipe(
    Effect.catchTags({
      Unauthorized: () =>
        Effect.succeed(
          Response.json(
            { error: "Invalid deployment credential." },
            { status: 401 },
          ),
        ),
      InvalidInput: () =>
        Effect.succeed(
          Response.json(
            { error: "Invalid deployment callback." },
            { status: 400 },
          ),
        ),
    }),
  )
  const result = await runApi(operation, request.signal)
  return Exit.match(result, {
    onSuccess: (response) => response,
    onFailure: () => {
      logFailure(result)
      return Response.json(
        { error: "Deployment storage is unavailable." },
        { status: 503 },
      )
    },
  })
}
