import { Effect, Redacted, Result } from "effect"
import { expect, it } from "vitest"
import { prepareEmailChange } from "../features/settings/email-change/form-model"

const input = {
  currentEmail: "old@example.test",
  newEmail: " Next@Example.Test ",
  confirmation: "next@example.test",
  password: " untouched-password ",
}
it("normalizes address confirmation while preserving and redacting the password", async () => {
  const prepared = await Effect.runPromise(prepareEmailChange(input))
  expect(prepared.newEmail).toBe("next@example.test")
  expect(Redacted.value(prepared.password)).toBe(input.password)
  expect(JSON.stringify(prepared)).not.toContain(input.password)
})
it.each([
  { newEmail: " OLD@example.test ", field: "email" },
  { newEmail: "not-an-address", field: "email" },
  { newEmail: `${"a".repeat(250)}@example.test`, field: "email" },
  { confirmation: "wrong@example.test", field: "confirmation" },
  { password: "", field: "password" },
])(
  "rejects invalid or unintended target before a request: $field",
  async ({ field, ...change }) => {
    const result = await Effect.runPromise(
      prepareEmailChange({ ...input, ...change }).pipe(Effect.result),
    )
    Result.match(result, {
      onSuccess: () =>
        expect.unreachable("Invalid input must fail before submission"),
      onFailure: (failure) => {
        expect(failure.field).toBe(field)
        expect(failure.message).not.toContain(input.password)
      },
    })
  },
)
