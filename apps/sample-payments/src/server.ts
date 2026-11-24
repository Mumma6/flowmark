import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { Data, Effect, Result, Schema } from "effect"
import { confirmPayment, type ConfirmationRevision } from "./confirm.js"
import { createSampleFlowmark, flowmarkBinding } from "./flowmark.js"
import { createProvider } from "./provider.js"
import { openStore } from "./store.js"

const RequestSchema = Schema.Struct({
  amountCents: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 1_000_000 }),
  ),
  provider: Schema.Literals([
    "same",
    "other",
    "missing",
    "none",
    "late",
    "fail",
  ]),
})

class RequestBodyError extends Data.TaggedError("RequestBodyError")<{
  readonly reason: string
}> {}

const revision = (): ConfirmationRevision =>
  process.env.PAYMENT_CONFIRMATION === "unlinked" ? "unlinked" : "linked"

const readBody = (request: import("node:http").IncomingMessage) =>
  Effect.tryPromise({
    try: () =>
      new Promise<unknown>((resolve, reject) => {
        const chunks: Buffer[] = []
        request.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        request.on("end", () => {
          try {
            resolve(
              JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
            )
          } catch {
            reject(new Error("invalid json"))
          }
        })
        request.on("error", reject)
      }),
    catch: () =>
      new RequestBodyError({ reason: "The request body is not JSON." }),
  })

export function start(
  port = Number(process.env.PORT ?? 3099),
  databasePath = process.env.SAMPLE_PAYMENTS_DB ??
    join(tmpdir(), "sample-payments.sqlite"),
) {
  const store = openStore(databasePath)
  const flowmark = createSampleFlowmark()
  const server = createServer((request, response) => {
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { "content-type": "application/json" })
      response.end(JSON.stringify(body))
    }
    void Effect.runPromise(
      Effect.gen(function* () {
        if (request.method === "GET" && request.url === "/health") {
          send(200, {
            synthetic: true,
            deployed: false,
            confirmation: revision(),
            flowmarkBinding: flowmarkBinding(),
          })
          return
        }
        if (request.method !== "POST" || request.url !== "/payments") {
          send(404, { error: "Not found" })
          return
        }
        const body = yield* readBody(request).pipe(
          Effect.flatMap((raw) =>
            Result.match(Schema.decodeUnknownResult(RequestSchema)(raw), {
              onFailure: () =>
                Effect.fail(
                  new RequestBodyError({
                    reason: "The payment request is invalid.",
                  }),
                ),
              onSuccess: (value) => Effect.succeed(value),
            }),
          ),
        )
        const payment = yield* Effect.tryPromise({
          try: () =>
            confirmPayment({
              store,
              provider: createProvider(body.provider),
              revision: revision(),
              id: randomUUID(),
              amountCents: body.amountCents,
              changeId: randomUUID(),
              flowmark,
            }),
          catch: () => "confirm-failed" as const,
        }).pipe(Effect.catch(() => Effect.succeed("confirm-failed" as const)))
        if (payment === "confirm-failed") {
          send(500, { error: "The payment could not be confirmed." })
          return
        }
        send(200, { synthetic: true, payment })
      }).pipe(
        Effect.catch(() =>
          Effect.sync(() => {
            if (!response.headersSent) {
              response.writeHead(400, { "content-type": "application/json" })
              response.end(
                JSON.stringify({ error: "Invalid payment request." }),
              )
            }
          }),
        ),
      ),
    )
  })
  server.listen(port, "127.0.0.1")
  server.on("close", () => store.close())
  return server
}

if (process.argv[1]?.endsWith("server.ts")) {
  start()
}
