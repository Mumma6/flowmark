import { Match, Result, Schema } from "effect"

const ProxyPlainError = Schema.Struct({
  error: Schema.String,
})

export const proxyUnavailableMessage =
  "Flowmark API is unavailable. Start or reconnect the API, then try again."

export const queryUnauthorizedMessage = "Sign in required to load this data."

export const queryForbiddenMessage =
  "You do not have access to this project or action."

const transformFailureMessage = "Unable to transform response from server"

export function isTrpcResponseBody(body: unknown) {
  if (Array.isArray(body)) {
    return body.every(
      (item) =>
        item &&
        typeof item === "object" &&
        ("result" in item || "error" in item),
    )
  }
  if (!body || typeof body !== "object") {
    return false
  }
  if ("result" in body) {
    return true
  }
  return (
    "error" in body &&
    body.error !== null &&
    typeof body.error === "object" &&
    !Array.isArray(body.error)
  )
}

export function mapPlainProxyError(status: number, error: string) {
  return Match.value(status).pipe(
    Match.when(401, () => queryUnauthorizedMessage),
    Match.when(403, () => queryForbiddenMessage),
    Match.when(502, () => proxyUnavailableMessage),
    Match.orElse(() => error),
  )
}

export function mapNonTrpcHttpError(status: number) {
  return Match.value(status).pipe(
    Match.when(401, () => queryUnauthorizedMessage),
    Match.when(403, () => queryForbiddenMessage),
    Match.when(
      (value) => value === 502 || value === 503 || value === 504,
      () => proxyUnavailableMessage,
    ),
    Match.orElse(() => null),
  )
}

/** Safe user-facing copy for React Query / tRPC failures at the browser boundary. */
export function presentQueryError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Could not load data."
  }
  if (error.message === transformFailureMessage) {
    return proxyUnavailableMessage
  }
  return error.message
}

export async function readDashboardTransportError(response: Response) {
  if (response.ok) {
    return null
  }
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body = await response
      .clone()
      .json()
      .catch(() => null)
    if (isTrpcResponseBody(body)) {
      return null
    }
    const parsed = Schema.decodeUnknownResult(ProxyPlainError)(body)
    return Result.match(parsed, {
      onFailure: () => mapNonTrpcHttpError(response.status),
      onSuccess: ({ error }) => mapPlainProxyError(response.status, error),
    })
  }
  return mapNonTrpcHttpError(response.status)
}

export async function dashboardTrpcFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const response = await fetch(input, { ...init, credentials: "include" })
  const message = await readDashboardTransportError(response)
  if (message) {
    throw new Error(message)
  }
  return response
}
