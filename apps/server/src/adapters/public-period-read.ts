import { ApiLive, ReadPublicPeriod } from "@flowmark/api"
import { Effect, type Layer } from "effect"
import { handlePublicRead } from "./public-read-http"

export const handlePublicPeriodRead = (
  request: Request,
  layer: Layer.Layer<ReadPublicPeriod, unknown> = ApiLive,
) =>
  handlePublicRead(
    request,
    (header, raw) =>
      Effect.flatMap(ReadPublicPeriod, (service) => service.read(header, raw)),
    layer,
  )
