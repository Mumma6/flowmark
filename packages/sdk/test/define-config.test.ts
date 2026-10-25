import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import { defineConfig } from "../src/index.js"
import {
  createFlowmark as createBrowserClient,
  defineConfig as defineBrowserConfig,
} from "../src/browser/index.js"
import type { DeliveryFailure } from "../src/errors/index.js"
import type { WorkflowEvent } from "@flowmark/core"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("defineConfig", () => {
  it("preserves server settings, object identity, and literal inference", () => {
    const settings = { apiKey: "secret", apiUrl: "http://localhost:3003" }
    expect(defineConfig(settings)).toBe(settings)
    const config = defineConfig({ apiUrl: "http://localhost:3003" })
    expectTypeOf(config.apiUrl).toEqualTypeOf<"http://localhost:3003">()
  })

  it("does not resolve environment variables or validate credentials", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FLOWMARK_API_KEY", "")
    expect(defineConfig({})).toEqual({})
    expect(defineConfig({ apiUrl: "not-a-url" }).apiUrl).toBe("not-a-url")
  })

  it("contextually types the instrumentation callback", () => {
    defineConfig({
      onInstrumentationError: (error, event) => {
        expectTypeOf(error).toEqualTypeOf<DeliveryFailure>()
        expectTypeOf(event).toEqualTypeOf<WorkflowEvent>()
      },
    })
    defineBrowserConfig({
      onInstrumentationError: (error, event) => {
        expectTypeOf(error).toEqualTypeOf<DeliveryFailure>()
        expectTypeOf(event).toEqualTypeOf<WorkflowEvent>()
      },
    })
  })

  it("defines browser settings lazily during SSR", async () => {
    vi.stubGlobal("location", undefined)
    const settings = { proxyPath: "/api/telemetry" }
    expect(defineBrowserConfig(settings)).toBe(settings)
    const config = defineBrowserConfig({ proxyPath: "/api/telemetry" })
    expectTypeOf(config.proxyPath).toEqualTypeOf<"/api/telemetry">()
    const client = createBrowserClient(config)
    await client.shutdown()
  })

  it("delivers using a configured browser client", async () => {
    vi.stubGlobal("location", { origin: "https://customer.example" })
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    )
    vi.stubGlobal("fetch", fetcher)
    const client = createBrowserClient(
      defineBrowserConfig({ proxyPath: "/api/telemetry" }),
    )
    client.workflow("configured").done()
    await client.shutdown()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0]?.[0].toString()).toBe(
      "https://customer.example/api/telemetry",
    )
  })

  it("rejects misspelled options and server secrets in browser config at compile time", () => {
    // @ts-expect-error Unknown server option.
    defineConfig({ apiUrL: "http://localhost:3003" })
    // @ts-expect-error Unknown options are rejected even alongside valid options.
    defineConfig({ apiUrl: "http://localhost:3003", typo: true })
    // @ts-expect-error Secret server keys do not belong in browser config.
    defineBrowserConfig({ apiKey: "secret", apiUrl: "http://localhost:3003" })
    // @ts-expect-error Invalid option type.
    defineBrowserConfig({ proxyPath: 42 })
  })
})
