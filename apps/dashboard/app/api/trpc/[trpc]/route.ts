import { proxyToApiHandler } from "../../../../lib/proxy-api"

export const runtime = "nodejs"

async function handler(
  request: Request,
  context: { params: Promise<{ trpc: string }> },
) {
  const { trpc } = await context.params
  return proxyToApiHandler(request, `/api/trpc/${trpc}`)
}

export { handler as GET, handler as POST }
