import { Array } from "effect"
import { proxyToApiHandler } from "../../../features/platform/api-proxy"
export const runtime = "nodejs"

// Public, write-only endpoint. No credentials, account data or membership status.
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors })
}
export async function POST(request: Request) {
  const response = await proxyToApiHandler(request, "/api/waitlist")
  const headers = new Headers(response.headers)
  Array.forEach(Object.entries(cors), ([key, value]) => headers.set(key, value))
  return new Response(response.body, { status: response.status, headers })
}
