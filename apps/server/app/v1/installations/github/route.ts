import { RepositoryInstallations, logFailure, runApi } from "@flowmark/api"
import { Effect, Exit, Match } from "effect"
import { readRawTextBody } from "../../../../src/adapters/request-body"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const apiOrigin = new URL(request.url).origin
  const operation = Effect.gen(function* () {
    const rawBody = yield* readRawTextBody(request)
    const installations = yield* RepositoryInstallations
    const result = yield* installations.handleWebhookDelivery({
      signatureHeader: request.headers.get("x-hub-signature-256"),
      rawBody,
      apiOrigin,
    })
    return Response.json(result, {
      headers: { "cache-control": "no-store" },
    })
  }).pipe(
    Effect.catchTags({
      InvalidInput: () =>
        Effect.succeed(
          Response.json(
            { error: "Invalid repository installation delivery." },
            { status: 400 },
          ),
        ),
      RepositoryInstallationRejected: (error) => {
        const status = Match.value(error.reason).pipe(
          Match.when("invalid-signature", () => 401),
          Match.whenOr(
            "foreign-repository",
            "grant-narrowed",
            "policy-escalation-rejected",
            "installation-revoked",
            () => 403,
          ),
          Match.when("installation-not-found", () => 404),
          Match.when("stale-event", () => 409),
          Match.when("host-unconfigured", () => 503),
          Match.orElse(() => 400),
        )
        return Effect.succeed(
          Response.json(
            { error: error.detail, reason: error.reason },
            { status },
          ),
        )
      },
    }),
  )
  const result = await runApi(operation, request.signal)
  return Exit.match(result, {
    onSuccess: (response) => response,
    onFailure: () => {
      logFailure(result)
      return Response.json(
        { error: "Repository installation storage is unavailable." },
        { status: 503 },
      )
    },
  })
}
