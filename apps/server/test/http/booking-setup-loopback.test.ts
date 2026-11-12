import { createServer, type Server } from "node:http"
import { Readable } from "node:stream"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Array, Effect, Option } from "effect"
import { createDatabase } from "@flowmark/db"
import { POST } from "../../app/v1/events/route"
import { GET } from "../../app/api/trpc/[trpc]/route"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"
import type { RouterOutputs } from "../../../dashboard/features/platform/api-types"
import { buildInvestigation } from "../../../dashboard/features/runs/investigation/investigation-model"
import { expectationLabel } from "../../../dashboard/features/expectations/expectation-presentation"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "existing booking setup example over real loopback HTTP",
  () => {
    let connection: ReturnType<typeof createDatabase>
    let server: Server
    let origin: string
    let fixture: Effect.Success<
      ReturnType<typeof createDefinitionImportFixture>
    >
    const read = async <A>(procedure: string, input: unknown): Promise<A> => {
      const response = await GET(
        new Request(
          `http://localhost:3001/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`,
          {
            headers: {
              cookie: fixture.cookie,
              "x-flowmark-project-id": fixture.projectId,
            },
          },
        ),
      )
      expect(response.status).toBe(200)
      return ((await response.json()) as { result: { data: A } }).result.data
    }
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      fixture = await Effect.runPromise(
        createDefinitionImportFixture(connection.db),
      )
      server = createServer((incoming, outgoing) => {
        const request = new Request(`http://127.0.0.1${incoming.url}`, {
          method: incoming.method,
          headers: incoming.headers as HeadersInit,
          body: Readable.toWeb(incoming),
          duplex: "half",
        } as RequestInit)
        void POST(request)
          .then(async (response) => {
            outgoing.statusCode = response.status
            response.headers.forEach((value, key) =>
              outgoing.setHeader(key, value),
            )
            outgoing.end(Buffer.from(await response.arrayBuffer()))
          })
          .catch(() => {
            outgoing.statusCode = 500
            outgoing.end("Fixture ingestion failed")
          })
      })
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      )
      const address = server.address()
      if (!address || typeof address === "string") {
        throw new Error("Missing fixture port")
      }
      origin = `http://127.0.0.1:${address.port}`
    })
    afterAll(async () => {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()))
      }
      await connection?.close()
      vi.unstubAllEnvs()
    })
    it("persists the unchanged example and supplies Studio's actual investigation and confirmation projections", async () => {
      // This standalone example owns its SDK type-resolution config; load it as
      // a runtime fixture instead of pulling its sources into Next's compilation.
      const { runBookingSetupDemo } = await vi.importActual<{
        runBookingSetupDemo: (options: {
          deliver: true
          apiUrl: string
          apiKey: string
        }) => Promise<{
          mode: string
          awaitingTerminal: boolean
          partialOutcome: string
          liveRunId?: string
        }>
      }>("../../../../packages/sdk/test/booking-setup-demo.runtime")
      const demo = await runBookingSetupDemo({
        deliver: true,
        apiUrl: origin,
        apiKey: fixture.writeKey,
      })
      expect(demo.mode).toBe("memory+loopback")
      expect(demo.awaitingTerminal).toBe(false)
      expect(demo.partialOutcome).toBe("no-availability")
      if (!demo.liveRunId) {
        throw new Error("Example did not deliver")
      }
      const listed = await read<RouterOutputs["run"]["list"]>("run.list", {
        workflow: "booking.create",
        externalId: demo.liveRunId,
      })
      expect(listed.runs).toHaveLength(1)
      const events = await read<RouterOutputs["run"]["detail"]>("run.detail", {
        id: listed.runs[0]!.id,
      })
      const model = Option.getOrThrow(buildInvestigation(events))
      expect(model.state).toBe("Completed")
      expect(model.completed).toMatchObject({
        outcome: "submitted",
        result: { submitted: 1 },
      })
      expect(
        Array.filter(events, (event) => event.type === "started"),
      ).toHaveLength(1)
      const confirmations = await read<RouterOutputs["run"]["expectations"]>(
        "run.expectations",
        { id: listed.runs[0]!.id },
      )
      expect(expectationLabel(confirmations.expectations[0]!)).toBe(
        "Observed on time",
      )
      expect(confirmations.expectations[0]?.settlement?.event).toMatchObject({
        outcome: "confirmed",
        result: { reserved: 1 },
      })
    }, 15000)
  },
)
