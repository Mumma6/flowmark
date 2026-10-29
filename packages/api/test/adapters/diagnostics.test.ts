import { randomUUID } from "node:crypto"
import { inspect } from "node:util"
import { Cause, Exit, FiberId } from "effect"
import { afterEach, expect, it, vi } from "vitest"
import { DatabaseError, DatabaseOperation } from "@flowmark/db/persistence"
import { ConfigurationError, PersistenceError } from "../../src/errors"
import { logFailure } from "../../src/diagnostics"

afterEach(() => vi.restoreAllMocks())

it("logs known operation/code labels without driver SQL, values, URLs or credentials", () => {
  const url = new URL("postgresql://localhost/diagnostics")
  url.password = randomUUID()
  const privateValue = randomUUID()
  const driver = Object.assign(new Error(`${url.href} ${privateValue}`), {
    code: "ECONNREFUSED",
    connectionString: url.href,
  })
  const query = Object.assign(
    new Error(`select * from projects where name = '${privateValue}'`),
    {
      params: [privateValue],
      cause: driver,
    },
  )
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  logFailure(
    Exit.fail(
      new PersistenceError({
        operation: DatabaseOperation.Authenticate,
        cause: query,
      }),
    ),
  )
  expect(log).toHaveBeenCalledWith("[Flowmark API] Request failed", {
    failures: [
      {
        type: "PersistenceError",
        operation: "authenticate",
        code: "ECONNREFUSED",
      },
    ],
    defects: [],
    interrupted: false,
  })
  const output = inspect(log.mock.calls, { depth: 20 })
  for (const value of [
    url.href,
    url.password,
    privateValue,
    "select *",
    "params",
  ]) {
    expect(output.includes(value)).toBe(false)
  }
})

it("sanitizes composite causes, cleanup defects and unknown labels", () => {
  const privateValue = randomUUID()
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  const cause = Cause.parallel(
    Cause.fail(new ConfigurationError({ cause: new Error(privateValue) })),
    Cause.sequential(
      Cause.fail(
        new PersistenceError({
          operation: privateValue,
          cause: { code: privateValue },
        }),
      ),
      Cause.die(
        new DatabaseError({
          operation: DatabaseOperation.Close,
          cause: new Error(privateValue),
        }),
      ),
    ),
  )
  logFailure(Exit.failCause(cause))
  expect(log.mock.calls[0][1]).toEqual({
    failures: [
      { type: "ConfigurationError", code: undefined },
      { type: "PersistenceError", operation: "unknown", code: undefined },
    ],
    defects: [{ type: "DatabaseError", operation: "close", code: undefined }],
    interrupted: false,
  })
  expect(inspect(log.mock.calls).includes(privateValue)).toBe(false)
})

it("does not print unexpected error text and handles interruption and success", () => {
  const privateValue = randomUUID()
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  logFailure(Exit.succeed(undefined))
  expect(log).not.toHaveBeenCalled()
  logFailure(Exit.die(new Error(privateValue)))
  expect(inspect(log.mock.calls).includes(privateValue)).toBe(false)
  logFailure(Exit.interrupt(FiberId.none))
  expect(log.mock.calls.at(-1)?.[1]).toMatchObject({ interrupted: true })
})
