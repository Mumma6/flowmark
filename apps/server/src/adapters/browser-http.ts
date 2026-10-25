import { Effect, Exit } from "effect"
import {
  BrowserForbidden,
  IngestBrowserWorkflowEvents,
  logFailure,
  runApi,
} from "@flowmark/api"
import { readJsonBody } from "./request-body"

function withCors(origin: string, response: Response) {
  const headers = new Headers(response.headers)
  headers.set("Access-Control-Allow-Origin", origin)
  headers.set("Vary", "Origin")
  headers.set("Cache-Control", "no-store")
  return new Response(response.body, { status: response.status, headers })
}

function unavailable(result: Exit.Exit<unknown, unknown>) {
  logFailure(result)
  return Response.json(
    { error: "Browser event storage is unavailable." },
    { status: 503 },
  )
}

export async function handleBrowserOptions(request: Request) {
  const origin = request.headers.get("origin")
  const operation = Effect.gen(function* () {
    const service = yield* IngestBrowserWorkflowEvents
    if (
      !origin ||
      request.headers.get("access-control-request-method") !== "POST" ||
      !(yield* service.originAllowed(origin))
    ) {
      return Response.json(
        { error: "Browser origin is not allowed." },
        { status: 403 },
      )
    }
    return withCors(
      origin,
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers":
            "content-type, authorization, traceparent, b3",
          "Access-Control-Max-Age": "600",
        },
      }),
    )
  })
  const result = await runApi(operation, request.signal)
  return Exit.match(result, {
    onSuccess: (response) => response,
    onFailure: () => unavailable(result),
  })
}

export async function handleBrowserIngestion(request: Request) {
  const origin = request.headers.get("origin")
  const operation = Effect.gen(function* () {
    if (!origin) {
      return yield* Effect.fail(new BrowserForbidden())
    }
    const service = yield* IngestBrowserWorkflowEvents
    const response = yield* service
      .ingest(
        request.headers.get("authorization"),
        origin,
        readJsonBody(request),
      )
      .pipe(
        Effect.as(Response.json({ accepted: true }, { status: 202 })),
        Effect.catchTags({
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
          BrowserRateLimited: () =>
            Effect.succeed(
              Response.json(
                {
                  error:
                    "Browser event limit reached (120 events per minute per key).",
                },
                { status: 429, headers: { "Retry-After": "60" } },
              ),
            ),
        }),
      )
    return withCors(origin, response)
  }).pipe(
    Effect.catchTags({
      BrowserUnauthorized: () =>
        Effect.succeed(
          Response.json(
            { error: "Invalid public browser key." },
            { status: 401 },
          ),
        ),
      BrowserForbidden: () =>
        Effect.succeed(
          Response.json(
            { error: "Browser origin is not allowed for this key." },
            { status: 403 },
          ),
        ),
    }),
  )
  const result = await runApi(operation, request.signal)
  return Exit.match(result, {
    onSuccess: (response) => response,
    onFailure: () => unavailable(result),
  })
}
