import { Data, Effect, Schema } from "effect"

export class ExportDownloadError extends Data.TaggedError(
  "ExportDownloadError",
)<{
  readonly reason: "Unavailable" | "InvalidResponse"
}> {}
const metadata = Schema.Struct({
  filename: Schema.String.check(
    Schema.isPattern(
      /^flowmark-(account|project)-[0-9a-f-]{36}-part-[1-9][0-9]*\.ndjson$/,
    ),
  ),
  complete: Schema.Literals(["true", "false"]),
  next: Schema.String.check(Schema.isPattern(/^$|^[0-9a-f-]{36}$/)),
  part: Schema.String.check(Schema.isPattern(/^[1-9][0-9]*$/)),
})

/** Same-origin authenticated POST; response bytes never enter a query cache or local storage. */
export const downloadExportPart = Effect.fn("DataExport.downloadPart")(
  function* (id: string, cursor: string, signal: AbortSignal) {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch("/api/data-export", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, cursor }),
          cache: "no-store",
          credentials: "same-origin",
          signal,
        }),
      catch: () => new ExportDownloadError({ reason: "Unavailable" }),
    })
    if (
      !response.ok ||
      !response.headers
        .get("content-type")
        ?.startsWith("application/x-ndjson") ||
      Number(response.headers.get("content-length")) > 2 * 1024 * 1024
    ) {
      return yield* new ExportDownloadError({ reason: "Unavailable" })
    }
    const filename = /^attachment; filename="([^"]+)"$/.exec(
      response.headers.get("content-disposition") ?? "",
    )?.[1]
    const meta = yield* Schema.decodeUnknownEffect(metadata)({
      filename,
      complete: response.headers.get("x-flowmark-export-complete"),
      next: response.headers.get("x-flowmark-export-next"),
      part: response.headers.get("x-flowmark-export-part"),
    }).pipe(
      Effect.mapError(
        () => new ExportDownloadError({ reason: "InvalidResponse" }),
      ),
    )
    if (
      !meta.filename.includes(id) ||
      (meta.complete === "true") !== (meta.next === "")
    ) {
      return yield* new ExportDownloadError({ reason: "InvalidResponse" })
    }
    const buffer = yield* Effect.tryPromise({
      try: () => response.arrayBuffer(),
      catch: () => new ExportDownloadError({ reason: "Unavailable" }),
    })
    if (buffer.byteLength > 2 * 1024 * 1024) {
      return yield* new ExportDownloadError({ reason: "InvalidResponse" })
    }
    const digest = yield* Effect.tryPromise({
      try: () => crypto.subtle.digest("SHA-256", buffer),
      catch: () => new ExportDownloadError({ reason: "InvalidResponse" }),
    })
    const encoded = btoa(String.fromCharCode(...new Uint8Array(digest)))
    if (response.headers.get("content-digest") !== `sha-256=:${encoded}:`) {
      return yield* new ExportDownloadError({ reason: "InvalidResponse" })
    }
    yield* Effect.acquireUseRelease(
      Effect.sync(() =>
        URL.createObjectURL(
          new Blob([buffer], { type: "application/x-ndjson;charset=utf-8" }),
        ),
      ),
      (url) =>
        Effect.sync(() => {
          const anchor = document.createElement("a")
          anchor.href = url
          anchor.download = meta.filename
          document.body.append(anchor)
          anchor.click()
          anchor.remove()
        }),
      (url) => Effect.sync(() => URL.revokeObjectURL(url)),
    )
    return {
      nextCursor: meta.next || null,
      complete: meta.complete === "true",
      part: Number(meta.part),
    }
  },
)
