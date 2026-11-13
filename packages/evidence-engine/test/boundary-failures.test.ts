import { beforeEach, expect, it, vi } from "vitest"
import { Effect } from "effect"
import { EvidenceEngine } from "../src/index.js"
import { loadBindings } from "../src/loader.js"

vi.mock("../src/loader.js", () => ({ loadBindings: vi.fn() }))
const invoke = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* Effect.result(
        (yield* EvidenceEngine).summarizeOperations([]),
      )
    }).pipe(Effect.provide(EvidenceEngine.layer)),
  )
beforeEach(() => vi.resetAllMocks())

it("keeps initialization failures explicit", async () => {
  vi.mocked(loadBindings).mockReturnValue(
    Effect.fail(new Error("missing asset")),
  )
  expect(await invoke()).toMatchObject({
    _tag: "Failure",
    failure: { stage: "initialization" },
  })
})
it.each([
  "not json",
  '{"version":2,"tag":"Ok","value":[]}',
  '{"version":1,"tag":"Ok","value":[{}]}',
])("rejects malformed WASM responses: %s", async (response) => {
  vi.mocked(loadBindings).mockReturnValue(
    Effect.succeed({
      summarize_operations_json: () => response,
      percentile_json: () => response,
    }),
  )
  expect(await invoke()).toMatchObject({
    _tag: "Failure",
    failure: { stage: "output" },
  })
})
it("keeps WASM traps in the failure channel", async () => {
  vi.mocked(loadBindings).mockReturnValue(
    Effect.succeed({
      summarize_operations_json: () => {
        throw new WebAssembly.RuntimeError("trap")
      },
      percentile_json: () => "",
    }),
  )
  expect(await invoke()).toMatchObject({
    _tag: "Failure",
    failure: { stage: "invocation" },
  })
})
