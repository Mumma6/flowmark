import { Context, Either, Redacted, Schema } from "effect"
import { FlowmarkConfigError } from "../errors/index.js"
import type { FlowmarkConfig } from "../types/index.js"
import { ApiOriginSchema } from "./api-origin.js"

const SettingsSchema = Schema.Struct({
  apiKey: Schema.RedactedFromSelf(Schema.String.pipe(Schema.minLength(1))),
  apiUrl: ApiOriginSchema,
})

export interface FlowmarkSettingsService {
  readonly apiKey: Redacted.Redacted<string>
  readonly apiUrl: string
}

export class FlowmarkSettings extends Context.Tag("@flowmark/node/Settings")<
  FlowmarkSettings,
  FlowmarkSettingsService
>() {}

export function resolveSettings(
  config: FlowmarkConfig,
): FlowmarkSettingsService {
  const apiKey = config.apiKey ?? process.env.FLOWMARK_API_KEY
  if (!apiKey) {
    throw new FlowmarkConfigError({
      cause:
        "A server write key is required. Set FLOWMARK_API_KEY in the server environment or pass apiKey to createFlowmark(). For the local repository demo, run pnpm dev:setup first. Never put a server key in browser configuration.",
    })
  }
  const decoded = Schema.decodeUnknownEither(SettingsSchema)({
    apiKey: apiKey === undefined ? undefined : Redacted.make(apiKey),
    apiUrl:
      config.apiUrl ??
      process.env.FLOWMARK_API_URL ??
      (process.env.NODE_ENV !== "production"
        ? "http://localhost:3003"
        : undefined),
  })
  return Either.match(decoded, {
    onLeft: (cause) => {
      throw new FlowmarkConfigError({ cause })
    },
    onRight: (settings) => settings,
  })
}
