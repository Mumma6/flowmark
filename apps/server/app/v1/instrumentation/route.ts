import { instrumentationGuide } from "../../../src/instrumentation-guide"

export const runtime = "nodejs"

/**
 * The handler reads the request origin, so Next cannot prerender one static
 * body. A shared cache may reuse the response for this host. Query strings
 * redirect to the canonical path so they do not create extra variants.
 */
const cacheControl =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=3600"

export function GET(request: Request) {
  const url = new URL(request.url)
  if (url.search !== "") {
    url.search = ""
    return new Response(null, {
      status: 308,
      headers: {
        location: url.toString(),
        "cache-control": cacheControl,
      },
    })
  }
  return new Response(instrumentationGuide(url.origin), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": cacheControl,
    },
  })
}
