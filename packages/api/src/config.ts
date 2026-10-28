import { assertPreviewDatabase } from "@flowmark/db/environment"
import { Context, Effect, Layer, Redacted, Schema } from "effect"
import { ConfigurationError } from "./errors.js"

const SettingsSchema = Schema.Struct({
  databaseUrl: Schema.RedactedFromSelf(Schema.NonEmptyString),
  demoMode: Schema.Boolean,
})

export interface ApiSettingsService {
  readonly databaseUrl: Redacted.Redacted<string>
  readonly demoMode: boolean
}

export class ApiSettings extends Context.Tag("@flowmark/api/Settings")<
  ApiSettings,
  ApiSettingsService
>() {
  static readonly layer = Layer.effect(
    ApiSettings,
    Effect.gen(function* () {
      const input = yield* Effect.sync(() => ({
        databaseUrl:
          process.env.DATABASE_URL === undefined
            ? undefined
            : Redacted.make(process.env.DATABASE_URL),
        demoMode: process.env.FLOWMARK_DEMO_MODE === "true",
      }))
      if (
        input.demoMode &&
        (process.env.NODE_ENV === "production" ||
          process.env.VERCEL_ENV === "production")
      ) {
        return yield* Effect.fail(
          new ConfigurationError({
            cause: new Error(
              "FLOWMARK_DEMO_MODE cannot be enabled in production.",
            ),
          }),
        )
      }
      if (input.demoMode && process.env.VERCEL_ENV === "preview") {
        return yield* Effect.fail(
          new ConfigurationError({
            cause: new Error(
              "FLOWMARK_DEMO_MODE cannot be enabled in preview.",
            ),
          }),
        )
      }
      yield* assertPreviewDatabase(process.env.DATABASE_URL).pipe(
        Effect.catchTags({
          PreviewDatabaseError: (error) =>
            Effect.fail(new ConfigurationError({ cause: error })),
        }),
      )
      return yield* Schema.decodeUnknown(SettingsSchema)(input).pipe(
        Effect.mapError((cause) => new ConfigurationError({ cause })),
      )
    }),
  )
}
