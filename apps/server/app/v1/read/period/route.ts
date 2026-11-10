import { handlePublicPeriodRead } from "../../../../src/adapters/public-period-read"

export const runtime = "nodejs"
const handler = (request: Request) => handlePublicPeriodRead(request)
export const POST = handler
export const GET = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const HEAD = handler
export const OPTIONS = handler
