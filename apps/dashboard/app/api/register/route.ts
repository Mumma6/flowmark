import { proxyToApiHandler } from "../../../lib/api/proxy"

export const runtime = "nodejs"

export function POST(request: Request) {
  return proxyToApiHandler(request, "/api/register")
}
