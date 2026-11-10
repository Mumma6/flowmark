import { ApiLive, ReadPublicRun } from "@flowmark/api"
import { Effect, type Layer } from "effect"
import { handlePublicRead } from "./public-read-http"

export const handlePublicRunRead = (
  request: Request,
  layer: Layer.Layer<ReadPublicRun, unknown> = ApiLive,
) =>
  handlePublicRead(
    request,
    (header, raw) =>
      Effect.flatMap(ReadPublicRun, (service) => service.read(header, raw)),
    layer,
  )
