import { Effect, Layer, Option, Result } from "effect"
import { expect, it, vi } from "vitest"
import { InvalidInput, Unauthorized } from "../../src/errors.js"
import { DataExports } from "../../src/features/data-exports/ports/data-exports.js"
import { ManageDataExports } from "../../src/features/data-exports/use-cases/manage-data-exports.js"
import { DataLifecycle } from "../../src/features/data-lifecycle/ports/data-lifecycle.js"

it("does not deliver materialized bytes after the live delivery authorization fails", async () => {
  const unused = () =>
    Effect.fail(new InvalidInput({ cause: "Unused test port." }))
  const check = vi.fn(() =>
    Effect.fail(new Unauthorized({ permission: "read" })),
  )
  const part = vi.fn(() =>
    Effect.succeed({
      body: "UNDELIVERED_SYNTHETIC_BYTES",
      complete: true,
      nextCursor: null,
      part: 1,
      filename: "synthetic.ndjson",
      bytes: 27,
    }),
  )
  const live = ManageDataExports.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(DataExports, {
          create: unused,
          latest: () => Effect.succeed(null),
          cancel: () => Effect.succeed({ cancelled: true }),
          part,
          check,
        }),
        Layer.succeed(DataLifecycle, {
          preview: unused,
          status: unused,
          confirm: unused,
          resume: unused,
          cancel: unused,
          reauthenticationBudget: () => Effect.succeed(true),
        }),
      ),
    ),
  )
  const result = await Effect.runPromise(
    Effect.flatMap(ManageDataExports, (manage) =>
      manage.part("owner", "current-session", "request", "cursor"),
    ).pipe(Effect.provide(live), Effect.result),
  )
  expect(result.pipe(Result.getFailure, Option.getOrThrow)._tag).toBe(
    "Unauthorized",
  )
  expect(part).toHaveBeenCalledOnce()
  expect(check).toHaveBeenCalledOnce()
  expect(JSON.stringify(result)).not.toContain("UNDELIVERED_SYNTHETIC_BYTES")
})
