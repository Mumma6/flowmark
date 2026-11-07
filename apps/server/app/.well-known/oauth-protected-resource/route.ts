export const dynamic = "force-dynamic"

import { handleMcpProtectedResourceMetadata } from "../../../src/adapters/mcp/route"

export const GET = (request: Request) =>
  handleMcpProtectedResourceMetadata(request)
