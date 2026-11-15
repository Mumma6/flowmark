import { proxyToApiHandler } from "../../../features/platform/api-proxy"
export const runtime = "nodejs"
export const POST = (request: Request) =>
  proxyToApiHandler(request, "/v1/data-export")
