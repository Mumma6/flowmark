import { instrumentationGuide } from "../../../src/instrumentation-guide"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request) {
  const apiOrigin = new URL(request.url).origin
  return new Response(instrumentationGuide(apiOrigin), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}
