import { Effect, Layer } from "effect"
import { FlowmarkSettings } from "../../../config/settings.js"
import { WorkflowTransport } from "../ports/workflow-transport.js"
import { makeHttpTransport } from "./http-transport.js"

export const HttpTransportLive = Layer.effect(
  WorkflowTransport,
  Effect.gen(function* () {
    const settings = yield* FlowmarkSettings
    return yield* makeHttpTransport({
      endpoint: new URL("/v1/events", settings.apiUrl).toString(),
      apiKey: settings.apiKey,
    })
  }),
)
