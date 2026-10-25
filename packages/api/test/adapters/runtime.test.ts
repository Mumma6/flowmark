import { inspect } from "node:util"
import { Effect, Either, Layer, Redacted } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as database from "@flowmark/db"
import { Database } from "@flowmark/db/store"
import { DatabaseLive } from "../../src/adapters/database"
import { ApiSettings } from "../../src/config"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

const settings = Layer.succeed(ApiSettings, {
  databaseUrl: Redacted.make("postgresql://127.0.0.1:1/unused"),
  demoMode: false,
})

describe("API request resource scope", () => {
  it.each(["success", "failure", "interruption"] as const)(
    "closes the database connection on %s",
    async (outcome) => {
      const connection = database.createDatabase(
        "postgresql://127.0.0.1:1/unused",
      )
      const close = vi.fn(connection.close)
      const create = vi
        .spyOn(database, "createDatabase")
        .mockReturnValue({ db: connection.db, close })
      const layer = DatabaseLive.pipe(Layer.provide(settings))
      const operation = Effect.flatMap(Database, () => {
        switch (outcome) {
          case "success":
            return Effect.void
          case "failure":
            return Effect.fail("expected")
          case "interruption":
            return Effect.interrupt
        }
      }).pipe(Effect.provide(layer))

      expect(create).not.toHaveBeenCalled()
      await Effect.runPromiseExit(operation)
      expect(create).toHaveBeenCalledOnce()
      expect(close).toHaveBeenCalledOnce()
    },
  )

  it("preserves initialization failures as typed database errors", async () => {
    const cause = new Error("invalid database configuration")
    vi.spyOn(database, "createDatabase").mockImplementation(() => {
      throw cause
    })
    const result = await Effect.runPromise(
      Effect.either(
        Database.pipe(
          Effect.provide(DatabaseLive.pipe(Layer.provide(settings))),
        ),
      ),
    )
    expect(result).toMatchObject({
      _tag: "Left",
      left: { _tag: "DatabaseError", operation: "connect", cause },
    })
  })

  it("surfaces connection cleanup failures rather than reporting success", async () => {
    const connection = database.createDatabase(
      "postgresql://127.0.0.1:1/unused",
    )
    await connection.close()
    const cause = new Error("close failed")
    vi.spyOn(database, "createDatabase").mockReturnValue({
      db: connection.db,
      close: () => Promise.reject(cause),
    })
    const result = await Effect.runPromise(
      Database.pipe(
        Effect.provide(DatabaseLive.pipe(Layer.provide(settings))),
        Effect.matchCause({
          onSuccess: () => undefined,
          onFailure: (failure) => failure,
        }),
      ),
    )
    expect(result).toMatchObject({
      _tag: "Die",
      defect: { _tag: "DatabaseError", operation: "close", cause },
    })
  })

  it("redacts the database URL and rejects invalid settings", async () => {
    const url = "postgresql://test-user:test-password@localhost/test"
    vi.stubEnv("DATABASE_URL", url)
    vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
    const value = await Effect.runPromise(
      ApiSettings.pipe(Effect.provide(ApiSettings.layer)),
    )
    expect(inspect(value)).not.toContain(url)
    expect(Redacted.value(value.databaseUrl)).toBe(url)
    vi.stubEnv("DATABASE_URL", "")
    const result = await Effect.runPromise(
      Effect.either(ApiSettings.pipe(Effect.provide(ApiSettings.layer))),
    )
    Either.match(result, {
      onLeft: (error) => expect(error._tag).toBe("ConfigurationError"),
      onRight: () => expect.fail("Empty database URL must fail"),
    })
  })
})
