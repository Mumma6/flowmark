import { Result, Schema } from "effect"

const SupportDetails = Schema.Struct({
  code: Schema.String.check(Schema.isPattern(/^[A-Z0-9_-]{0,64}$/)),
  context: Schema.String.check(Schema.isMaxLength(1000)),
})

/** Only deliberately entered text. No URL, error object, telemetry or browser storage. */
export const supportDetailsPreview = (input: unknown) =>
  Result.match(Schema.decodeUnknownResult(SupportDetails)(input), {
    onFailure: () =>
      ({
        error:
          "Use a short error code and at most 1,000 characters of context.",
      }) as const,
    onSuccess: ({ code, context }) =>
      ({
        text: `Application: Flowmark Studio\nError code: ${code || "Not supplied"}\nContext: ${context || "Not supplied"}`,
      }) as const,
  })
