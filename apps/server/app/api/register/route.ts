import { registerOwner } from "../../../src/adapters/register-http"

export const runtime = "nodejs"

export function POST(request: Request) {
  return registerOwner(request)
}
