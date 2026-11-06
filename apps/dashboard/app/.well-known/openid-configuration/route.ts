import { AGENT_ACCESS_ISSUER_PROXY_PATHS } from "@flowmark/auth/agent-access/proxy-route"
import { proxyIssuerPath } from "../../../../features/platform/api-proxy"

export const runtime = "nodejs"

const handler = (request: Request) =>
  proxyIssuerPath(request, AGENT_ACCESS_ISSUER_PROXY_PATHS.openIdConfiguration)

export { handler as GET, handler as POST }
