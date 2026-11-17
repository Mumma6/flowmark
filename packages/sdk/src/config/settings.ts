import { Context, Result, Redacted, Schema } from "effect"
import { FlowmarkConfigError } from "../errors/index.js"
import type { FlowmarkConfig } from "../types/index.js"
import { ApiOriginSchema } from "./api-origin.js"

const SettingsSchema = Schema.Struct({
  apiKey: Schema.Redacted(
    Schema.String.pipe(Schema.check(Schema.isPattern(/\S/))),
  ),
  apiUrl: ApiOriginSchema,
})

export interface FlowmarkSettingsService {
  readonly apiKey: Redacted.Redacted<string>
  readonly apiUrl: string
}
export class FlowmarkSettings extends Context.Service<
  FlowmarkSettings,
  FlowmarkSettingsService
>()("@flowmarkdev/node/Settings") {}

export function resolveSettings(
  config: FlowmarkConfig,
): FlowmarkSettingsService {
  const apiKey = config.apiKey ?? process.env.FLOWMARK_API_KEY
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new FlowmarkConfigError({
      cause:
        "A server write key is required. Set FLOWMARK_API_KEY in the server environment or pass apiKey to createFlowmark(). Never put a server key in browser configuration.",
    })
  }
  const decoded = Schema.decodeUnknownResult(SettingsSchema)({
    apiKey: apiKey === undefined ? undefined : Redacted.make(apiKey),
    apiUrl:
      config.apiUrl ??
      process.env.FLOWMARK_API_URL ??
      "https://api.flowmark.dev",
  })
  return Result.match(decoded, {
    onFailure: (cause) => {
      throw new FlowmarkConfigError({ cause })
    },
    onSuccess: (settings) => settings,
  })
}
