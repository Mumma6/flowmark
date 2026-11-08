import { proxyToApiHandler } from "../../../features/platform/api-proxy"
export const runtime = "nodejs"
const handler = (request: Request) =>
  proxyToApiHandler(request, "/v1/agent-consent")
export { handler as GET, handler as POST }
