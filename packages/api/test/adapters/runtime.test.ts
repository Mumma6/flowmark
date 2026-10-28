import { inspect } from "node:util"
import { Effect, Either, Layer, Match, Redacted } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as database from "@flowmark/db"
import { Database, DatabaseOperation } from "@flowmark/db/persistence"
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
      const operation = Effect.flatMap(Database, () =>
        Match.value(outcome).pipe(
          Match.when("success", () => Effect.void),
          Match.when("failure", () => Effect.fail("expected")),
          Match.when("interruption", () => Effect.interrupt),
          Match.exhaustive,
        ),
      ).pipe(Effect.provide(layer))

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
    Either.match(result, {
      onLeft: (error) =>
        expect(error).toMatchObject({
          _tag: "DatabaseError",
          operation: DatabaseOperation.Connect,
          cause,
        }),
      onRight: () => expect.fail("expected a database connect failure"),
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
    Match.value(result).pipe(
      Match.tag("Die", ({ defect }) =>
        expect(defect).toMatchObject({
          _tag: "DatabaseError",
          operation: DatabaseOperation.Close,
          cause,
        }),
      ),
      Match.orElse(() => expect.fail("expected a connection cleanup defect")),
    )
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

  it("rejects demo mode in production", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/flowmark")
    vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
    vi.stubEnv("NODE_ENV", "production")
    const result = await Effect.runPromise(
      Effect.either(ApiSettings.pipe(Effect.provide(ApiSettings.layer))),
    )
    Either.match(result, {
      onLeft: (error) => expect(error._tag).toBe("ConfigurationError"),
      onRight: () => expect.fail("Production demo mode must fail"),
    })
  })

  it("rejects a preview runtime that still points at a non-preview database", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:secret@ep-fake.example.com/neondb",
    )
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("FLOWMARK_DATABASE_BRANCH", "")
    const result = await Effect.runPromise(
      Effect.either(ApiSettings.pipe(Effect.provide(ApiSettings.layer))),
    )
    Either.match(result, {
      onLeft: (error) => {
        expect(error._tag).toBe("ConfigurationError")
        expect(String(error.cause)).not.toContain("secret")
      },
      onRight: () => expect.fail("Preview without the branch marker must fail"),
    })
  })
})
