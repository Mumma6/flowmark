import { readFile } from "node:fs/promises"
import {
  createFlowmarkReadClient,
  FlowmarkReadError,
  type RunReadInput,
} from "@flowmarkdev/node/read"

// A server-side consumer of the public Promise API. No tRPC, database or Effect
// runtime is required by this script. Never pass the read key as an argument.
async function main() {
  const apiBaseUrl = process.env.FLOWMARK_API_URL
  const readKey = process.env.FLOWMARK_READ_KEY
  const file = process.argv[2]
  if (!apiBaseUrl || !readKey || !file) {
    throw new Error(
      "Set FLOWMARK_API_URL and FLOWMARK_READ_KEY; provide a Studio selection JSON file, then an optional next cursor.",
    )
  }
  // The client validates unknown runtime data; the type is only its TS input.
  const selection = JSON.parse(await readFile(file, "utf8")) as RunReadInput
  const client = createFlowmarkReadClient({ apiBaseUrl, readKey })
  const controller = new AbortController()
  const cancel = () => controller.abort()
  process.once("SIGINT", cancel)
  try {
    const cursor = process.argv[3]
    const response = await client.readRun(
      cursor ? { ...selection, cursor } : selection,
      { signal: controller.signal },
    )
    console.log(JSON.stringify(response, null, 2))
    if (response.page.events.length === 0) {
      console.log("No retained events on this page.")
    }
    if (response.page.nextCursor) {
      console.log(
        "More evidence is available. Pass page.nextCursor explicitly for the next read.",
      )
    }
    if (process.env.FLOWMARK_STUDIO_URL) {
      const studio = new URL(process.env.FLOWMARK_STUDIO_URL)
      if (
        !["http:", "https:"].includes(studio.protocol) ||
        studio.username ||
        studio.password ||
        studio.search ||
        studio.hash
      ) {
        throw new Error("Invalid Studio base URL.")
      }
      console.log(
        new URL(
          response.evidence.runPath.slice(1),
          `${studio.toString().replace(/\/$/, "")}/`,
        ).toString(),
      )
    }
  } finally {
    process.removeListener("SIGINT", cancel)
  }
}

main().catch((error: unknown) => {
  // Never echo unexpected errors, request bodies or configuration values.
  console.error(
    error instanceof FlowmarkReadError
      ? `${error.code} (HTTP ${error.status ?? "none"}); retry after ${error.retryAfterSeconds ?? "unspecified"} seconds.`
      : "Read failed. Check configuration and the selection JSON file.",
  )
  process.exitCode = 1
})
