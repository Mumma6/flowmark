import { Effect, Exit } from "effect"
import {
  IngestWorkflowEvents,
  logFailure,
  runApi,
} from "@flowmark/api"
import { readJsonBody } from "./request-body"

export async function handleIngestion(request: Request) {
  const operation = Effect.gen(function* () {
    const ingestion = yield* IngestWorkflowEvents
    yield* ingestion.ingest(
      request.headers.get("authorization"),
      readJsonBody(request),
    )
    return Response.json({ accepted: true }, { status: 202 })
  }).pipe(
    Effect.catchTags({
      Unauthorized: () =>
        Effect.succeed(
          Response.json({ error: "Invalid ingestion key." }, { status: 401 }),
        ),
      InvalidInput: () =>
        Effect.succeed(
          Response.json(
            { error: "Invalid workflow event (maximum 64 KiB)." },
            { status: 400 },
          ),
        ),
      RunNotFound: () =>
        Effect.succeed(
          Response.json(
            { error: "Send the started event before other run events." },
            { status: 409 },
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
        { error: "Event storage is unavailable." },
        { status: 503 },
      )
    },
  })
}
