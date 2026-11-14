import { afterEach, describe, expect, it, vi } from "vitest"
import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps"
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import { runEvidenceView } from "../src/controller.js"
import type { EvidenceAction } from "../src/lifecycle.js"
import { args, result, structured } from "./fixtures.js"

const fibers: Fiber.Fiber<unknown>[] = []
afterEach(async () => {
  await Effect.runPromise(Effect.forEach(fibers.splice(0), Fiber.interrupt))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const setup = async (tools = true, pendingConnect?: Promise<void>) => {
  const app = new App({ name: "test", version: "1" }, {}, { autoResize: false })
  vi.spyOn(app, "connect").mockImplementation(
    () => pendingConnect ?? Promise.resolve(),
  )
  vi.spyOn(app, "getHostCapabilities").mockReturnValue(
    tools ? { serverTools: {} } : {},
  )
  const resize = vi.fn()
  vi.spyOn(app, "setupSizeChangedNotifications").mockReturnValue(resize)
  const transport = new PostMessageTransport({} as Window, {} as Window)
  const close = vi.spyOn(transport, "close").mockResolvedValue(undefined)
  const read = vi.spyOn(app, "callServerTool").mockResolvedValue(result)
  const render = vi.fn(),
    theme = vi.fn(),
    actions = vi.fn<(action: EvidenceAction) => void>()
  const fiber = Effect.runFork(
    runEvidenceView(app, transport, render, theme, (navigate) =>
      actions.mockImplementation(navigate),
    ),
  )
  fibers.push(fiber)
  await vi.waitFor(() => expect(app.connect).toHaveBeenCalledOnce())
  const supply = async () => {
    app.ontoolinput?.({ arguments: args })
    app.ontoolresult?.(result)
    await vi.waitFor(() =>
      expect(render.mock.lastCall?.[0].kind).toBe("snapshot"),
    )
  }
  return { app, resize, close, read, render, theme, actions, fiber, supply }
}

describe("SDK view lifecycle", () => {
  it("clears evidence and actions on errors/cancellation, then releases observers and transport on teardown", async () => {
    const view = await setup()
    await view.supply()
    view.app.ontoolresult?.({ isError: true, content: [] })
    await vi.waitFor(() =>
      expect(view.render.mock.lastCall?.[0].kind).toBe("message"),
    )
    view.actions("refresh")
    expect(view.read).not.toHaveBeenCalled()
    await view.supply()
    view.app.ontoolcancelled?.({ reason: "cancelled" })
    await vi.waitFor(() =>
      expect(view.render.mock.lastCall?.[0].message).toContain("cancelled"),
    )
    view.app.onhostcontextchanged?.({ theme: "dark" })
    await vi.waitFor(() => expect(view.theme).toHaveBeenLastCalledWith("dark"))
    await Reflect.apply(view.app.onteardown!, view.app, [{}, {}])
    await vi.waitFor(() => expect(view.close).toHaveBeenCalledOnce())
    expect(view.resize).toHaveBeenCalledOnce()
    const count = view.render.mock.calls.length
    view.app.ontoolresult?.(result)
    view.actions("next")
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(view.render).toHaveBeenCalledTimes(count)
    expect(view.read).not.toHaveBeenCalled()
  })
  it("navigates only the same scoped run, refreshes the displayed page and prevents duplicate reads", async () => {
    const view = await setup()
    await view.supply()
    let finish!: (value: Awaited<ReturnType<App["callServerTool"]>>) => void
    view.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    view.actions("next")
    view.actions("next")
    await vi.waitFor(() => expect(view.read).toHaveBeenCalledOnce())
    expect(view.read.mock.calls[0]?.[0]).toEqual({
      name: "get_run",
      arguments: { ...args, limit: 50, cursor: "next" },
    })
    expect(view.render.mock.lastCall?.[0].busy).toBe(true)
    finish({
      ...result,
      structuredContent: {
        ...structured,
        page: {
          ...structured.page,
          nextCursor: null,
          events: [
            {
              id: "second",
              type: "completed",
              timestamp: "2026-11-10T09:00:02Z",
            },
          ],
        },
      },
    })
    await vi.waitFor(() =>
      expect(view.render.mock.lastCall?.[0].evidence?.nextCursor).toBe(null),
    )
    expect(
      view.render.mock.lastCall?.[0].evidence.snapshot.evidenceNote,
    ).toContain("continuation")
    view.actions("next")
    view.actions("refresh")
    await vi.waitFor(() => expect(view.read).toHaveBeenCalledTimes(2))
    expect(view.read.mock.calls[1]?.[0]).toEqual(view.read.mock.calls[0]?.[0])
  })
  it.each(["input", "result", "cancel", "close"] as const)(
    "aborts an in-flight read on %s and ignores its late result",
    async (ending) => {
      const view = await setup()
      await view.supply()
      let signal: AbortSignal | undefined
      let finish!: (value: Awaited<ReturnType<App["callServerTool"]>>) => void
      view.read.mockImplementationOnce((_params, options) => {
        signal = options?.signal
        return new Promise((resolve) => {
          finish = resolve
        })
      })
      view.actions("refresh")
      await vi.waitFor(() => expect(view.read).toHaveBeenCalledOnce())
      if (ending === "input") {
        view.app.ontoolinput?.({ arguments: { ...args, runId: "replacement" } })
      }
      if (ending === "result") {
        view.app.ontoolresult?.({
          ...result,
          structuredContent: {
            ...structured,
            summary: { ...structured.summary, workflow: "replacement" },
          },
        })
      }
      if (ending === "cancel") {
        view.app.ontoolcancelled?.({ reason: "cancelled" })
      }
      if (ending === "close") {
        view.app.onclose?.()
      }
      await vi.waitFor(() => expect(signal?.aborted).toBe(true))
      const state = view.render.mock.lastCall?.[0]
      finish(result)
      await new Promise((resolve) => setTimeout(resolve, 5))
      expect(view.render.mock.lastCall?.[0]).toEqual(state)
      expect(state.kind).toBe(ending === "result" ? "snapshot" : "message")
      if (ending === "result") {
        expect(state.evidence.snapshot.workflow).toBe("replacement")
      }
    },
  )
  it("refreshes projected business evidence and clears it after publication or authority changes", async () => {
    const view = await setup()
    const business = (revision: number, published: boolean) => ({
      structuredContent: {
        tool: "get_run",
        projectId: args.projectId,
        evidence: {
          projection: {
            version: 1,
            depth: "business",
            projectId: args.projectId,
            publicationRevision: revision,
            observedAt: "2026-11-13T00:00:00Z",
            withheld: ["errors"],
          },
          data: {
            kind: "run",
            summary: { ...structured.summary, outcome: "accepted" },
            fields: published
              ? [
                  {
                    revision: "v1",
                    path: ["accepted"],
                    label: "Accepted",
                    unit: null,
                    kind: "count",
                    state: "available",
                    value: 3,
                  },
                ]
              : [],
            references: [],
          },
        },
      },
      content: [],
    })
    view.app.ontoolinput?.({ arguments: args })
    view.app.ontoolresult?.(business(1, true))
    await vi.waitFor(() =>
      expect(view.render.mock.lastCall?.[0].evidence.kind).toBe("business"),
    )
    expect(view.render.mock.lastCall?.[0].evidence).not.toHaveProperty(
      "snapshot",
    )
    view.actions("next")
    expect(view.read).not.toHaveBeenCalled()
    view.read.mockResolvedValueOnce(business(2, false))
    view.actions("refresh")
    await vi.waitFor(() =>
      expect(view.render.mock.lastCall?.[0].evidence.business.revision).toBe(2),
    )
    expect(view.render.mock.lastCall?.[0].evidence.business.fields).toEqual([])
    expect(view.read.mock.calls[0]?.[0]).toMatchObject({
      name: "get_run",
      arguments: {
        projectId: args.projectId,
        runId: args.runId,
        section: "events",
      },
    })
    view.read.mockResolvedValueOnce({
      isError: true,
      content: [],
      _meta: { "io.flowmark/evidence": { state: "access-unavailable" } },
    })
    view.actions("refresh")
    await vi.waitFor(() =>
      expect(view.render.mock.lastCall?.[0].status).toBe("access-unavailable"),
    )
    expect(view.render.mock.lastCall?.[0]).not.toHaveProperty("evidence")
    view.actions("refresh")
    expect(view.read).toHaveBeenCalledTimes(2)
  })
  it("clears inaccessible authority without retrying cached references", async () => {
    const view = await setup()
    await view.supply()
    view.read.mockResolvedValueOnce({
      isError: true,
      content: [{ type: "text", text: "Not authorized" }],
      _meta: { "io.flowmark/evidence": { state: "access-unavailable" } },
    })
    view.actions("refresh")
    await vi.waitFor(() =>
      expect(view.render.mock.lastCall?.[0].status).toBe("access-unavailable"),
    )
    view.actions("refresh")
    view.actions("next")
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(view.read).toHaveBeenCalledOnce()
    expect(view.render.mock.lastCall?.[0].message).toContain("expired")
    await view.supply()
    expect(view.render.mock.lastCall?.[0].kind).toBe("snapshot")
  })
  it("clears failed transport reads and rejects cross-project results", async () => {
    const view = await setup()
    await view.supply()
    view.read.mockRejectedValueOnce(new Error("PRIVATE_ERROR"))
    view.actions("refresh")
    await vi.waitFor(() =>
      expect(view.render.mock.lastCall?.[0].status).toBe("unavailable"),
    )
    expect(JSON.stringify(view.render.mock.lastCall)).not.toContain(
      "PRIVATE_ERROR",
    )
    await view.supply()
    view.read.mockResolvedValueOnce({
      ...result,
      structuredContent: { ...structured, projectId: "foreign" },
    })
    view.actions("next")
    await vi.waitFor(() =>
      expect(view.render.mock.lastCall?.[0].message).toContain("references"),
    )
    expect(view.render.mock.lastCall?.[0].kind).toBe("message")
  })
  it("keeps supplied-data hosts usable without attempting outgoing reads", async () => {
    const view = await setup(false)
    await view.supply()
    expect(view.render.mock.lastCall?.[0].canRead).toBe(false)
    view.actions("refresh")
    view.actions("next")
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(view.read).not.toHaveBeenCalled()
  })
  it("does not attach observers or render late results when closed during connect", async () => {
    let finish!: () => void
    const view = await setup(
      true,
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    view.app.onclose?.()
    await vi.waitFor(() => expect(view.close).toHaveBeenCalledOnce())
    const count = view.render.mock.calls.length
    finish()
    view.app.ontoolinput?.({ arguments: args })
    view.app.ontoolresult?.(result)
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(view.render).toHaveBeenCalledTimes(count)
    expect(view.resize).not.toHaveBeenCalled()
  })
  it("fails closed on a host-message burst instead of dropping scope boundaries", async () => {
    const view = await setup()
    await view.supply()
    Array.forEach(Array.range(0, 100), () =>
      view.app.ontoolinput?.({ arguments: args }),
    )
    await vi.waitFor(() => expect(view.close).toHaveBeenCalledOnce())
    expect(view.render.mock.lastCall?.[0].kind).toBe("message")
    expect(view.render.mock.lastCall?.[0].message).toContain("Too many")
    view.actions("next")
    expect(view.read).not.toHaveBeenCalled()
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
