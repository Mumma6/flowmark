import { Data, Option, Result, Schema, pipe } from "effect"

export class DashboardPublicConfigurationError extends Data.TaggedError(
  "DashboardPublicConfigurationError",
)<{
  readonly reason: string
}> {}

const DocumentationUrl = Schema.String.check(
  Schema.makeFilter((value) => {
    return pipe(
      Option.liftThrowable((candidate: string) => new URL(candidate))(value),
      Option.filter(
        (url) =>
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password,
      ),
      Option.isSome,
    )
  }),
)

export function resolveDocumentationUrl(
  configured: string | undefined,
  development: boolean,
) {
  const candidate = pipe(
    Option.fromNullishOr(configured),
    Option.getOrElse(() =>
      development
        ? "http://localhost:3002/docs/introduction"
        : "https://docs.flowmark.dev/docs/introduction",
    ),
  )
  return pipe(
    Schema.decodeUnknownResult(DocumentationUrl)(candidate),
    Result.match({
      onSuccess: (value) => value,
      onFailure: () => {
        throw new DashboardPublicConfigurationError({
          reason:
            "NEXT_PUBLIC_FLOWMARK_DOCS_URL must be an HTTP(S) URL without credentials.",
        })
      },
    }),
  )
}

/** Build-time, browser-safe configuration. Never import server config here. */
export const publicConfig = {
  authPath: "/api/auth",
  registerPath: "/api/register",
  trpcPath: "/api/trpc",
  query: { refetchInterval: 3000, retry: 1 },
  documentationUrl: resolveDocumentationUrl(
    process.env.NEXT_PUBLIC_FLOWMARK_DOCS_URL,
    process.env.NODE_ENV === "development",
  ),
} as const
