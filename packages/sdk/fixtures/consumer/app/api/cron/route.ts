import { generateBriefing } from "../../../lib/briefing"
import { flowmark } from "../../../lib/flowmark.js"

export const runtime = "nodejs"

// The host's scheduler calls this endpoint. Flowmark must not schedule the job.
export async function POST(request: Request) {
  if (
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  const { jobId } = await request.json()
  try {
    return Response.json(await generateBriefing(flowmark, jobId))
  } catch {
    return Response.json({ error: "briefing-unavailable" }, { status: 503 })
  }
}
