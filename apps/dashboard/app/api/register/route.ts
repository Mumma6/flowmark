import { proxyToApiHandler } from "../../../features/platform/api-proxy"

export const runtime = "nodejs"

export function POST(request: Request) {
  return proxyToApiHandler(request, "/api/register")
}
