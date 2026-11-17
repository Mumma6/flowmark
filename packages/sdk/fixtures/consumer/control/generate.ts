import { generateBriefing } from "./briefing"

try {
  console.log(
    JSON.stringify(await generateBriefing(process.argv[2] ?? "daily")),
  )
} catch {
  console.error("briefing-unavailable")
  process.exitCode = 1
}
