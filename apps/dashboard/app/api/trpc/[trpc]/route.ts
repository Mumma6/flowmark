import { DEMO_READ_KEY } from "@flowmark/db/demo"

export const runtime = "nodejs"

async function handler(request: Request) {
  if (process.env.FLOWMARK_DEMO_MODE !== "true") {
    return Response.json(
      {
        error:
          "Local development dashboard access is disabled. Configure real authentication before production use.",
      },
      { status: 403 },
    )
  }
  const url = new URL(request.url)
  const base = process.env.FLOWMARK_API_URL ?? "http://localhost:3003"
  const endpoint = new URL(`${url.pathname}${url.search}`, base)
  try {
    const response = await fetch(endpoint, {
      method: request.method,
      headers: {
        authorization: `Bearer ${DEMO_READ_KEY}`,
        "content-type": "application/json",
      },
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    })
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    })
  } catch (cause) {
    console.error("[Flowmark dashboard] API request failed", cause)
    return Response.json(
      { error: "Flowmark API is unavailable." },
      { status: 502 },
    )
  }
}

export { handler as GET, handler as POST }
