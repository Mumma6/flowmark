import { Effect, Exit } from "effect"
import { JoinWaitlist, runApi } from "@flowmark/api"
import { readJsonBody } from "./request-body"

const headers = { "cache-control": "no-store" }
export async function handleWaitlist(request: Request) {
  const result = await runApi(
    Effect.gen(function* () {
      const body = yield* readJsonBody(request)
      const waitlist = yield* JoinWaitlist
      return Response.json(yield* waitlist.join(body), { headers })
    }).pipe(
      Effect.catchTags({
        InvalidInput: () =>
          Effect.succeed(
            Response.json(
              { error: "Enter a valid email address." },
              { status: 400, headers },
            ),
          ),
        ManagementRateLimited: (error) =>
          Effect.succeed(
            Response.json(
              { error: "Too many requests. Please try again shortly." },
              {
                status: 429,
                headers: {
                  ...headers,
                  "retry-after": String(error.retryAfter),
                },
              },
            ),
          ),
      }),
    ),
    request.signal,
  )
  return Exit.match(result, {
    onSuccess: (response) => response,
    // Never log request bodies or email addresses on this public endpoint.
    onFailure: () =>
      Response.json(
        { error: "Could not join the waitlist. Please try again." },
        { status: 503, headers },
      ),
  })
}
