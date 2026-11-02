import { createHmac, timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"
import { Data, Effect } from "effect"

export const AUTH_CLIENT_IP_HEADER = "x-flowmark-auth-client-ip"
export const AUTH_PROXY_IDENTITY_HEADER = "x-flowmark-auth-proxy-identity"

interface AuthIdentityEnvironment extends Readonly<
  Record<string, string | undefined>
> {
  readonly VERCEL?: string
  readonly FLOWMARK_AUTH_PROXY_SECRET?: string
  readonly FLOWMARK_AUTH_TRUSTED_IP_HEADER?: string
}

export class AuthClientIdentityError extends Data.TaggedError(
  "AuthClientIdentityError",
)<{
  readonly reason: "invalid" | "configuration"
}> {}

const canonicalIp = (value: string | null) => {
  if (!value || !isIP(value)) {
    return undefined
  }
  return isIP(value) === 6
    ? new URL(`http://[${value}]`).hostname.slice(1, -1)
    : value
}

export const authRequestPath = (pathname: string) =>
  pathname === "/api/register"
    ? "/sign-up/email"
    : pathname.replace(/^\/api\/auth/, "")

const proxySecret = Effect.fn("Auth.proxySecret")(function* (
  env: AuthIdentityEnvironment,
) {
  const secret = env.FLOWMARK_AUTH_PROXY_SECRET
  if (secret !== undefined && secret.length < 32) {
    return yield* new AuthClientIdentityError({ reason: "configuration" })
  }
  return secret
})

const platformIp = Effect.fn("Auth.platformIp")(function* (
  headers: Headers,
  env: AuthIdentityEnvironment,
) {
  if (env.VERCEL === "1") {
    return canonicalIp(headers.get("x-vercel-forwarded-for"))
  }
  const selected = env.FLOWMARK_AUTH_TRUSTED_IP_HEADER
  if (selected && selected !== "x-real-ip" && selected !== "cf-connecting-ip") {
    return yield* new AuthClientIdentityError({ reason: "configuration" })
  }
  // Opt-in only: the operator must make the origin reachable solely via a proxy
  // that overwrites this header. A header name alone does not establish trust.
  return selected ? canonicalIp(headers.get(selected)) : undefined
})

const signature = (
  secret: string,
  timestamp: string,
  ip: string,
  method: string,
  path: string,
) =>
  createHmac("sha256", secret)
    .update(
      JSON.stringify([
        "flowmark-auth-proxy-v1",
        timestamp,
        ip,
        method,
        authRequestPath(path),
      ]),
    )
    .digest("hex")

/** Server-only metadata; authenticates a rate-limit source, never a user/session. */
export const signAuthProxyIdentity = Effect.fn("Auth.signProxyIdentity")(
  function* (
    request: Request,
    pathname: string,
    env: AuthIdentityEnvironment = process.env,
    now = Date.now(),
  ) {
    const secret = yield* proxySecret(env)
    if (!secret) {
      return undefined
    }
    const ip = (yield* platformIp(request.headers, env)) ?? "-"
    const timestamp = String(Math.floor(now / 1000))
    return `${timestamp};${ip};${signature(secret, timestamp, ip, request.method, pathname)}`
  },
)

export const normalizeAuthClientIdentity = Effect.fn(
  "Auth.normalizeClientIdentity",
)(function* (
  request: Request,
  env: AuthIdentityEnvironment = process.env,
  now = Date.now(),
) {
  const headers = new Headers(request.headers)
  headers.delete(AUTH_CLIENT_IP_HEADER)
  const assertion = headers.get(AUTH_PROXY_IDENTITY_HEADER)
  headers.delete(AUTH_PROXY_IDENTITY_HEADER)
  let ip: string | undefined
  if (assertion !== null) {
    const secret = yield* proxySecret(env)
    if (!secret) {
      return yield* new AuthClientIdentityError({ reason: "configuration" })
    }
    const parts = assertion.length <= 256 ? assertion.split(";") : []
    const [timestamp = "", claimedIp = "", mac = ""] = parts
    const age = now / 1000 - Number(timestamp)
    if (
      parts.length !== 3 ||
      !/^\d{10}$/.test(timestamp) ||
      age < -5 ||
      age > 30 ||
      !/^[a-f0-9]{64}$/.test(mac) ||
      (claimedIp !== "-" && !canonicalIp(claimedIp))
    ) {
      return yield* new AuthClientIdentityError({ reason: "invalid" })
    }
    const expected = signature(
      secret,
      timestamp,
      claimedIp,
      request.method,
      new URL(request.url).pathname,
    )
    if (
      !timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex"))
    ) {
      return yield* new AuthClientIdentityError({ reason: "invalid" })
    }
    ip = canonicalIp(claimedIp)
  } else {
    ip = yield* platformIp(headers, env)
  }
  if (ip) {
    headers.set(AUTH_CLIENT_IP_HEADER, ip)
  }
  // Next.js can supply a Request from another fetch implementation. Rebuild by
  // URL instead of passing its object to a different implementation's constructor.
  const init: RequestInit & { duplex: "half" } = {
    method: request.method,
    headers,
    signal: request.signal,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    duplex: "half",
  }
  return new Request(request.url, init)
})
