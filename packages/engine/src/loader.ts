import { Effect } from "effect"

export interface WasmBindings {
  readonly summarize_operations_json: (input: string) => string
  readonly compare_summaries_json: (input: string) => string
  readonly has_cycle_json: (input: string) => string
  readonly percentile_json: (input: string) => string
}

/** Node's module cache owns one initialized WASM instance per worker.
 * Loading remains lazy so unrelated API requests do not require the engine.
 */
export const loadBindings = (): Effect.Effect<WasmBindings, unknown> =>
  Effect.tryPromise(() => import("../wasm/engine.js"))
