export const dynamic = "force-dynamic"

import { handleMcpPost } from "../../src/adapters/mcp/route"

export const POST = (request: Request) => handleMcpPost(request)

export const GET = () =>
  Response.json(
    { message: "Only POST is supported for MCP over HTTP." },
    { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
  )

export const maxDuration = 30
