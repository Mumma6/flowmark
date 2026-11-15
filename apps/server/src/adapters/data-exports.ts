import { createHash } from "node:crypto"
import { TRPCError } from "@trpc/server"
import { Effect, Schema } from "effect"
import {
  InvalidInput,
  ManageDataExports,
  PersistenceError,
  Unauthorized,
} from "@flowmark/api"
import { getAuth } from "../auth"
import { serverOrigins } from "../server-env"
import { readJsonBody } from "./request-body"
import { sessionQuery } from "./trpc/execution"
import { UuidSchema } from "./trpc/schemas"

export const currentExportSession = Effect.fn("currentExportSession")(
  function* (request: Request, userId: string) {
    const auth = yield* getAuth().pipe(
      Effect.mapError(
        (cause) => new PersistenceError({ operation: "export-session", cause }),
      ),
    )
    const current = yield* Effect.tryPromise({
      try: () =>
        auth.api.getSession({
          headers: request.headers,
          query: { disableCookieCache: true },
        }),
      catch: (cause) =>
        new PersistenceError({ operation: "export-session", cause }),
    })
    if (!current || current.user.id !== userId) {
      return yield* new Unauthorized({ permission: "read" })
    }
    return current.session.id
  },
)

const PartInput = Schema.Struct({ id: UuidSchema, cursor: UuidSchema })
export async function handleExportDownload(
  request: Request,
): Promise<Response> {
  const headers = {
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  }
  try {
    const { dashboardOrigin } = await Effect.runPromise(serverOrigins())
    if (request.headers.get("origin") !== dashboardOrigin) {
      return new Response("A trusted Studio origin is required.", {
        status: 403,
        headers,
      })
    }
    const result = await sessionQuery(request, (userId) =>
      Effect.gen(function* () {
        const sessionId = yield* currentExportSession(request, userId)
        const body = yield* readJsonBody(request)
        const input = yield* Schema.decodeUnknownEffect(PartInput)(body, {
          onExcessProperty: "error",
        }).pipe(
          Effect.mapError(
            () => new InvalidInput({ cause: "Invalid export part request." }),
          ),
        )
        const manager = yield* ManageDataExports
        return yield* manager.part(userId, sessionId, input.id, input.cursor)
      }),
    )
    return new Response(result.body, {
      headers: {
        ...headers,
        "content-type": "application/x-ndjson; charset=utf-8",
        "content-disposition": `attachment; filename="${result.filename}"`,
        "content-digest": `sha-256=:${createHash("sha256").update(result.body).digest("base64")}:`,
        "x-flowmark-export-next": result.nextCursor ?? "",
        "x-flowmark-export-complete": String(result.complete),
        "x-flowmark-export-part": String(result.part),
      },
    })
  } catch (error) {
    const status =
      error instanceof TRPCError && error.code === "UNAUTHORIZED"
        ? 401
        : error instanceof TRPCError && error.code === "BAD_REQUEST"
          ? 400
          : 503
    return new Response(
      "Export unavailable or incomplete. Retry this part, or start a new export if it expired or access changed.",
      { status, headers },
    )
  }
}
