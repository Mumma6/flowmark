import { proxyToApiHandler } from "../../../../lib/proxy-api"

export const runtime = "nodejs"

async function handler(
  request: Request,
  context: { params: Promise<{ all: string[] }> },
) {
  const { all } = await context.params
  return proxyToApiHandler(request, `/api/auth/${all.join("/")}`)
}

export { handler as GET, handler as POST }
