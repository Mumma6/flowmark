import { Result, Schema } from "effect"

const StudioReturnPath = Schema.String.check(
  Schema.isPattern(
    /^\/(?:|overview|runs(?:\/[a-fA-F0-9-]{36})?|workflows|insights|issues|investigations|connect|settings|onboarding|account(?:\/(?:help|security))?|data-privacy)$/,
  ),
)

/** Retain only known local pages, never callback tokens, query strings or external URLs. */
export const studioReturnPath = (value: unknown) =>
  Result.match(Schema.decodeUnknownResult(StudioReturnPath)(value), {
    onFailure: () => undefined,
    onSuccess: (path) => path,
  })
