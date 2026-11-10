import { afterEach, describe, expect, it, vi } from "vitest"
import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps"
import * as Effect from "effect/Effect"
import { connectEvidenceView } from "../src/controller.js"
import { args, result } from "./fixtures.js"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe("SDK view lifecycle", () => {
  it("clears evidence on replacement/error/cancellation/teardown and releases observers", async () => {
    vi.useFakeTimers()
    const app = new App(
      { name: "test", version: "1" },
      {},
      { autoResize: false },
    )
    vi.spyOn(app, "connect").mockResolvedValue(undefined)
    const resize = vi.fn()
    vi.spyOn(app, "setupSizeChangedNotifications").mockReturnValue(resize)
    const transport = new PostMessageTransport({} as Window, {} as Window)
    const close = vi.spyOn(transport, "close").mockResolvedValue(undefined)
    const render = vi.fn(),
      theme = vi.fn()
    const controller = connectEvidenceView(app, transport, render, theme)
    await Effect.runPromise(controller.connect)
    app.ontoolinput?.({ arguments: args })
    app.ontoolresult?.(result)
    expect(render.mock.lastCall?.[0].kind).toBe("snapshot")
    app.ontoolresult?.({ isError: true, content: [] })
    expect(render.mock.lastCall?.[0].kind).toBe("message")
    app.ontoolinput?.({ arguments: args })
    app.ontoolresult?.(result)
    app.ontoolcancelled?.({ reason: "cancelled" })
    expect(render.mock.lastCall?.[0].message).toContain("cancelled")
    app.onhostcontextchanged?.({ theme: "dark" })
    expect(theme).toHaveBeenLastCalledWith("dark")
    await Reflect.apply(app.onteardown!, app, [{}, {}])
    expect(resize).toHaveBeenCalledTimes(1)
    await vi.runAllTimersAsync()
    expect(close).toHaveBeenCalledOnce()
    const count = render.mock.calls.length
    app.ontoolresult?.(result)
    expect(render).toHaveBeenCalledTimes(count)
    controller.dispose()
  })
  it("uses the actual SDK transport to reject messages from other windows and removes its listener", async () => {
    const listeners = new Set<(event: MessageEvent) => void>()
    vi.stubGlobal("window", {
      addEventListener: (_name: string, fn: (event: MessageEvent) => void) =>
        listeners.add(fn),
      removeEventListener: (_name: string, fn: (event: MessageEvent) => void) =>
        listeners.delete(fn),
    })
    const source = {} as Window
    const transport = new PostMessageTransport(source, source)
    const received = vi.fn()
    transport.onmessage = received
    await transport.start()
    const message = {
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: result,
    }
    listeners.forEach((fn) =>
      fn({ source: {} as Window, data: message } as MessageEvent),
    )
    expect(received).not.toHaveBeenCalled()
    listeners.forEach((fn) => fn({ source, data: message } as MessageEvent))
    expect(received).toHaveBeenCalledOnce()
    await transport.close()
    expect(listeners.size).toBe(0)
  })
})
