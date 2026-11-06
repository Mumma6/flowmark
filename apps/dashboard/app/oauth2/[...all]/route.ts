import { Option } from "effect"
import { oauthIssuerPath } from "@flowmark/auth/agent-access/proxy-route"
import { proxyIssuerPath } from "../../../features/platform/api-proxy"

export const runtime = "nodejs"

async function handler(
  request: Request,
  context: { params: Promise<{ all: string[] }> },
) {
  const { all } = await context.params
  return Option.match(oauthIssuerPath(all), {
    onNone: () =>
      new Response(null, {
        status: 404,
        headers: { "cache-control": "no-store" },
      }),
    onSome: (issuerPath) => proxyIssuerPath(request, issuerPath),
  })
}

export { handler as GET, handler as POST }
