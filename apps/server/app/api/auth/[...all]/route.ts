import { Effect } from "effect"
import { toNextJsHandler } from "better-auth/next-js"
import { getAuth } from "../../../../src/auth"

async function handlers() {
  const auth = await Effect.runPromise(getAuth())
  return toNextJsHandler(auth)
}

export const GET = async (request: Request) => (await handlers()).GET(request)
export const POST = async (request: Request) => (await handlers()).POST(request)
