import { expect, it } from "vitest"
import { AuthorizeAgentRead, PersistenceError } from "@flowmark/api"
import { Effect } from "effect"
import { consumeAdmission } from "../src/runtime/admission.js"

it("fails closed when the injected API admission is unavailable", async () => {
  const error = await Effect.runPromise(
    consumeAdmission("synthetic-service", 10).pipe(
      Effect.provideService(AuthorizeAgentRead, {
        grantFamily: () => Effect.succeed({ familyId: "unused" }),
        consumeBudget: () =>
          Effect.fail(
            new PersistenceError({
              operation: "mcp-admission",
              cause: new Error("synthetic storage failure"),
            }),
          ),
      }),
      Effect.flip,
    ),
  )
  expect(error.reason).toBe("Read admission is unavailable.")
  expect(error.reason).not.toContain("synthetic storage failure")
})

it("retains the retry interval on admission exhaustion", async () => {
  const error = await Effect.runPromise(
    consumeAdmission("grant:family", 10).pipe(
      Effect.provideService(AuthorizeAgentRead, {
        grantFamily: () => Effect.succeed({ familyId: "unused" }),
        consumeBudget: () => Effect.succeed({ allowed: false, retryAfter: 23 }),
      }),
      Effect.flip,
    ),
  )
  expect(error.reason).toBe("Read budget exhausted. Retry after 23 seconds.")
})
