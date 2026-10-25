import { proxyToApiHandler } from "../../../lib/proxy-api"

export const runtime = "nodejs"

export function POST(request: Request) {
  return proxyToApiHandler(request, "/api/register")
}
