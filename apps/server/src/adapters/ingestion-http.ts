import { Effect, Exit } from "effect"
import { IngestWorkflowEvents, logFailure, runApi } from "@flowmark/api"
import { ingestionReceipt } from "./ingestion-receipt"
import { readJsonBody } from "./request-body"

export async function handleIngestion(request: Request) {
  const operation = Effect.gen(function* () {
    const ingestion = yield* IngestWorkflowEvents
    const disposition = yield* ingestion.ingest(
      request.headers.get("authorization"),
      readJsonBody(request),
      request.headers.get("x-flowmark-expectations") === "v1",
    )
    return ingestionReceipt(disposition)
  }).pipe(
    Effect.catchTags({
      ExpectationSourceForbidden: () =>
        Effect.succeed(
          Response.json(
            {
              error:
                "Server expectation reporting requires the expectations-v1 SDK protocol.",
              code: "EXPECTATION_SOURCE_FORBIDDEN",
            },
            { status: 403 },
          ),
        ),
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
            {
              error: "Send the started event before other run events.",
              code: "RUN_NOT_FOUND",
            },
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
