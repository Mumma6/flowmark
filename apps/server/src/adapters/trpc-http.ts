import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "./trpc"

const dashboardOrigin =
  process.env.FLOWMARK_DASHBOARD_ORIGIN ?? "http://localhost:3001"

function withCors(request: Request, response: Response) {
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
  withCors(
    req,
    await fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: () => ({ request: req }),
    }),
  )

export function handleTrpcOptions(req: Request) {
  return withCors(req, new Response(null, { status: 204 }))
}
