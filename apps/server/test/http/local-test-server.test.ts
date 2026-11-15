import { Effect, Exit } from "effect"
import { expect, it } from "vitest"
import { localTestServer } from "./support/local-test-server"

it("closes the scoped loopback server when the test body fails", async () => {
  let origin = ""
  const result = await Effect.runPromiseExit(
    Effect.scoped(
      Effect.gen(function* () {
        const server = yield* localTestServer(() => new Response("synthetic"))
        origin = server.origin
        const response = yield* Effect.promise(() => fetch(origin))
        const text = yield* Effect.promise(() => response.text())
        expect(text).toBe("synthetic")
        return yield* Effect.fail("synthetic assertion failure")
      }),
    ),
  )
  expect(Exit.isFailure(result)).toBe(true)
  await expect(fetch(origin)).rejects.toThrow()
})
