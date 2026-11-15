import { readFile, writeFile } from "node:fs/promises"
import { parseArgs } from "node:util"
import {
  createFlowmarkReadClient,
  FlowmarkReadError,
  type RunReadInput,
  type PeriodReadInput,
} from "@flowmarkdev/node/read"

// A server-side consumer of the public Promise API. No tRPC, database or Effect
// runtime is required by this script. Never pass the read key as an argument.
async function main() {
  const apiBaseUrl = process.env.FLOWMARK_API_URL
  const readKey = process.env.FLOWMARK_READ_KEY
  const { values, positionals } = parseArgs({
    options: { snapshot: { type: "string" } },
    allowPositionals: true,
  })
  const [file, cursor] = positionals
  if (values.snapshot !== undefined && values.snapshot.length === 0) {
    throw new FlowmarkReadError("UNSUPPORTED_SELECTION")
  }
  if (!apiBaseUrl || !readKey || !file || positionals.length > 2) {
    throw new Error(
      "Set FLOWMARK_API_URL and FLOWMARK_READ_KEY; provide a Studio selection JSON file, an optional next cursor, and optionally --snapshot /path/to/new-snapshot.json.",
    )
  }
  // The client validates unknown runtime data; the type is only its TS input.
  const selection = JSON.parse(await readFile(file, "utf8")) as
    RunReadInput | PeriodReadInput
  const client = createFlowmarkReadClient({ apiBaseUrl, readKey })
  const controller = new AbortController()
  const cancel = () => controller.abort()
  process.once("SIGINT", cancel)
  try {
    if (selection.kind === "period" && (cursor || values.snapshot)) {
      throw new FlowmarkReadError("UNSUPPORTED_SELECTION")
    }
    const response =
      selection.kind === "period"
        ? await client.readPeriod(selection, { signal: controller.signal })
        : await client.readRun(cursor ? { ...selection, cursor } : selection, {
            signal: controller.signal,
          })
    if (values.snapshot && "page" in response) {
      // Workspace-only presentation seam; loaded only when explicitly requested.
      const { publicReadSnapshotJson } =
        await import("@flowmark/evidence-view/public-read")
      const snapshot = await publicReadSnapshotJson(response)
      // Never overwrite an existing file. A saved copy is not a live authorization.
      await writeFile(values.snapshot, snapshot, { flag: "wx", mode: 0o600 })
    }
    console.log(JSON.stringify(response, null, 2))
    if ("page" in response) {
      if (response.page.events.length === 0) {
        console.log("No retained events on this page.")
      }
      if (response.page.nextCursor) {
        console.log(
          "More evidence is available. Pass page.nextCursor explicitly for the next read.",
        )
      }
    } else {
      if (response.report.current.totalRuns === 0) {
        console.log("No reported runs started in the current window.")
      }
      if (!response.coverage.previousWindowHasRuns) {
        console.log(
          "The previous window has no reported runs; no baseline is available.",
        )
      }
      console.log(
        "Counts and recorded durations describe reported evidence, not causation or current activity.",
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
          ("page" in response
            ? response.evidence.runPath
            : response.evidence.periodPath
          ).slice(1),
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
