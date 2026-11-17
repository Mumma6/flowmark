import { createFlowmark } from "@flowmarkdev/node"
import { generateBriefing } from "../lib/briefing"

const flowmark = createFlowmark()
try {
  console.log(
    JSON.stringify(
      await generateBriefing(flowmark, process.argv[2] ?? "daily"),
    ),
  )
} catch {
  console.error("briefing-unavailable")
  process.exitCode = 1
} finally {
  try {
    await flowmark.shutdown()
  } catch (error) {
    console.error("Flowmark delivery failed", error)
  }
}
