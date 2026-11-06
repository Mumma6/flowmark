import { assertPreviewDatabase } from "@flowmark/db/environment"
import { Context, Effect, Layer, Redacted, Schema } from "effect"
import { ConfigurationError } from "./errors.js"

const SettingsSchema = Schema.Struct({
  databaseUrl: Schema.Redacted(Schema.NonEmptyString),
  demoMode: Schema.Boolean,
  /** MCP resource URL for consent/grant checks, e.g. `{apiOrigin}/mcp`. */
  mcpResourceUrl: Schema.optional(Schema.String),
})

export interface ApiSettingsService {
  readonly databaseUrl: Redacted.Redacted<string>
  readonly demoMode: boolean
  readonly mcpResourceUrl: string | undefined
}
export class ApiSettings extends Context.Service<
  ApiSettings,
  ApiSettingsService
>()("@flowmark/api/Settings") {
  static readonly layer = Layer.effect(
    ApiSettings,
    Effect.gen(function* () {
      const input = yield* Effect.sync(() => {
        const flowmarkApiUrl = process.env.FLOWMARK_API_URL?.trim()
        const explicitMcp = process.env.FLOWMARK_MCP_RESOURCE_URL?.trim()
        const derivedMcp =
          explicitMcp ??
          (flowmarkApiUrl
            ? `${flowmarkApiUrl.replace(/\/$/, "")}/mcp`
            : undefined)
        return {
          databaseUrl:
            process.env.DATABASE_URL === undefined
              ? undefined
              : Redacted.make(process.env.DATABASE_URL),
          demoMode: process.env.FLOWMARK_DEMO_MODE === "true",
          mcpResourceUrl: derivedMcp,
        }
      })
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
      const decoded = yield* Schema.decodeUnknownEffect(SettingsSchema)(
        input,
      ).pipe(Effect.mapError((cause) => new ConfigurationError({ cause })))
      return {
        databaseUrl: decoded.databaseUrl,
        demoMode: decoded.demoMode,
        mcpResourceUrl: decoded.mcpResourceUrl ?? undefined,
      } satisfies ApiSettingsService
    }),
  )
}
