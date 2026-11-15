import { createServer } from "node:http"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"
import { runReadEvidencePath } from "@flowmarkdev/core"

it("exports a scoped read to a portable file without copying credentials or overwriting existing evidence", async () => {
  const selection = {
    version: 1,
    kind: "run",
    section: "events",
    projectId: "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-000000000002",
  } as const
  const directory = await mkdtemp(join(tmpdir(), "flowmark-portable-read-"))
  const input = join(directory, "selection.json")
  const output = join(directory, "evidence.json")
  const secret = "fm_read_SYNTHETIC_SECRET_CANARY"
  const server = createServer((request, response) => {
    expect(request.url).toBe("/v1/read/run")
    expect(request.headers.authorization).toBe(`Bearer ${secret}`)
    expect(request.headers.cookie).toBeUndefined()
    response.setHeader("content-type", "application/json")
    response.end(
      JSON.stringify({
        version: 1,
        selection: { ...selection, limit: 50 },
        observedAt: "2026-11-15T10:00:00.000Z",
        summary: {
          id: selection.runId,
          workflow: "synthetic.booking-confirmation",
          status: "Completed",
          startedAt: "2026-11-15T09:00:00.000Z",
          durationMs: 500,
          eventCount: 1,
        },
        page: {
          events: [
            {
              id: "00000000-0000-4000-8000-000000000003",
              type: "completed",
              timestamp: "2026-11-15T09:00:00.500Z",
              durationMs: 500,
              properties: { secret: "PRIVATE_PAYLOAD_CANARY" },
            },
          ],
          limit: 50,
          totalEvents: 1,
          nextCursor: null,
        },
        evidence: { runPath: runReadEvidencePath({ ...selection, limit: 50 }) },
        omissions: ["event_payloads", "business_results"],
      }),
    )
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  try {
    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("Missing test port")
    }
    await writeFile(input, JSON.stringify(selection))
    const args = [
      "--filter",
      "@flowmark/db",
      "exec",
      "tsx",
      "--tsconfig",
      "../../examples/tsconfig.json",
      "../../examples/read-run.ts",
      input,
      "--snapshot",
      output,
    ]
    const options = {
      cwd: fileURLToPath(new URL("../../../", import.meta.url)),
      env: {
        ...process.env,
        FLOWMARK_API_URL: `http://127.0.0.1:${address.port}`,
        FLOWMARK_READ_KEY: secret,
        FLOWMARK_STUDIO_URL: "",
      },
    }
    const { stdout } = await promisify(execFile)("pnpm", args, options)
    const json = await readFile(output, "utf8")
    const snapshot = JSON.parse(json)
    expect(snapshot.workflow).toBe("synthetic.booking-confirmation")
    expect(snapshot.status).toBe("Completed")
    expect(snapshot.evidenceNote).toContain(selection.projectId)
    expect(snapshot.evidenceNote).toContain(
      "Observed at 2026-11-15T10:00:00.000Z",
    )
    expect(snapshot.metrics).toEqual([])
    expect(json + stdout).not.toMatch(
      /SYNTHETIC_SECRET_CANARY|PRIVATE_PAYLOAD_CANARY/,
    )
    if (process.platform !== "win32") {
      expect((await stat(output)).mode & 0o777).toBe(0o600)
    }
    await expect(
      promisify(execFile)("pnpm", args, options),
    ).rejects.toMatchObject({ code: 1 })
    expect(await readFile(output, "utf8")).toBe(json)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    await rm(directory, { recursive: true, force: true })
  }
}, 20000)
