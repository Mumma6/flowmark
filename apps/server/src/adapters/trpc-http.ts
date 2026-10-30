import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { Effect, Result } from "effect"
import { serverOrigins } from "../server-env"
import { appRouter } from "./trpc"

function withCors(
  request: Request,
  response: Response,
  dashboardOrigin: string,
) {
  const headers = new Headers(response.headers)

  if (request.headers.get("origin") === dashboardOrigin) {
    headers.set("Access-Control-Allow-Origin", dashboardOrigin)
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "content-type, authorization")
    headers.set("Vary", "Origin")
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export const handleTrpc = async (req: Request) =>
  Result.match(await Effect.runPromise(Effect.result(serverOrigins())), {
    onFailure: (error) =>
      Response.json({ error: error.reason }, { status: 500 }),
    onSuccess: async ({ dashboardOrigin }) =>
      withCors(
        req,
        await fetchRequestHandler({
          endpoint: "/api/trpc",
          req,
          router: appRouter,
          createContext: () => ({ request: req }),
        }),
        dashboardOrigin,
      ),
  })

export const handleTrpcOptions = async (req: Request) =>
  Result.match(await Effect.runPromise(Effect.result(serverOrigins())), {
    onFailure: (error) =>
      Response.json({ error: error.reason }, { status: 500 }),
    onSuccess: ({ dashboardOrigin }) =>
      withCors(req, new Response(null, { status: 204 }), dashboardOrigin),
  })
