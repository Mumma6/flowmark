import { providerRead } from "./provider-read.js"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { Effect, Schema } from "effect"
import {
  loadApiEnvironment,
  readLocalDevelopmentDatabaseUrl,
} from "@flowmark/db/commands"
import { DatasetConflict } from "@flowmark/db/fixtures"

const refuse = (reason: string) => new DatasetConflict({ reason })
export const checkRuntime = (environment: string, env: NodeJS.ProcessEnv) => {
  if (
    !["local", "staging"].includes(environment) ||
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV ||
    env.FLOWMARK_MIGRATION_APPROVED ||
    env.FLOWMARK_MIGRATION_WRAPPER ||
    env.DATABASE_MIGRATION_URL ||
    env.TEST_DATABASE_URL
  ) {
    return Effect.fail(
      refuse(
        "Run the fixture CLI from a workstation with --env local or staging; unset database/migration/test overrides. Production and Preview are forbidden.",
      ),
    )
  }
  if (
    environment === "staging" &&
    (env.DATABASE_URL ||
      env.FLOWMARK_DEMO_MODE ||
      env.BETTER_AUTH_URL ||
      env.FLOWMARK_API_URL ||
      env.FLOWMARK_DASHBOARD_ORIGIN)
  ) {
    return Effect.fail(
      refuse(
        "Unset local database/demo/auth/API overrides before Staging operations. Only the guarded Staging source is accepted.",
      ),
    )
  }
  return Effect.void
}

const postgresUrl = (value: string | undefined) =>
  Effect.try({
    try: () => {
      const url = new URL(value ?? "")
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !url.hostname.endsWith(".neon.tech") ||
        url.hostname.includes("-pooler.") ||
        url.hash ||
        url.searchParams.get("sslmode") !== "require" ||
        [...url.searchParams.keys()].some(
          (key) => !["sslmode", "channel_binding"].includes(key),
        )
      ) {
        throw new Error()
      }
      return url
    },
    catch: () =>
      refuse("Expected a direct Neon URL from the guarded environment files."),
  })
export const checkStagingUrls = Effect.fn("Meridian.checkStagingUrls")(
  function* (
    staging: ReadonlyMap<string, string>,
    production: ReadonlyMap<string, string>,
    preview: ReadonlyMap<string, string>,
  ) {
    if (staging.get("NEON_BRANCH") !== "staging") {
      return yield* refuse("The Staging env file must identify branch staging.")
    }
    const urls = yield* Effect.all([
      postgresUrl(staging.get("DATABASE_URL_UNPOOLED")),
      postgresUrl(production.get("DATABASE_URL_UNPOOLED")),
      postgresUrl(preview.get("DATABASE_URL_UNPOOLED")),
    ])
    if (new Set(urls.map((url) => url.hostname)).size !== 3) {
      return yield* refuse(
        "Staging, Production and Preview endpoints must be distinct.",
      )
    }
    return urls[0]
  },
)

const Branches = Schema.Struct({
  branches: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      project_id: Schema.String,
    }),
  ),
})
const Endpoints = Schema.Struct({
  endpoints: Schema.Array(
    Schema.Struct({
      host: Schema.String,
      branch_id: Schema.String,
      project_id: Schema.String,
    }),
  ),
})

/** Proves the actual endpoint using fresh read-only provider inventory, not an env label. */
export const checkNeonIdentity = Effect.fn("Meridian.checkNeonIdentity")(
  function* (
    host: string,
    projectId: string,
    branchInput: unknown,
    endpointInput: unknown,
  ) {
    const branches = yield* Schema.decodeUnknownEffect(Branches)(
      branchInput,
    ).pipe(
      Effect.mapError(() =>
        refuse("Could not decode live Neon branch identity."),
      ),
    )
    const endpoints = yield* Schema.decodeUnknownEffect(Endpoints)(
      endpointInput,
    ).pipe(
      Effect.mapError(() =>
        refuse("Could not decode live Neon endpoint identity."),
      ),
    )
    const staging = branches.branches.filter(
      (branch) => branch.name === "staging" && branch.project_id === projectId,
    )
    const matches = endpoints.endpoints.filter(
      (endpoint) => endpoint.host === host && endpoint.project_id === projectId,
    )
    if (
      staging.length !== 1 ||
      matches.length !== 1 ||
      matches[0]!.branch_id !== staging[0]!.id ||
      branches.branches.some(
        (branch) => branch.id === staging[0]!.id && branch.name !== "staging",
      )
    ) {
      return yield* refuse(
        "Live Neon endpoint does not belong exclusively to the requested Staging branch.",
      )
    }
  },
)

const readEnv = Effect.fn("Meridian.readEnv")(function* (path: string) {
  const source = yield* Effect.tryPromise({
    try: () => readFile(path, "utf8"),
    catch: () =>
      refuse(
        "Missing guarded Neon env file; use the existing neon:env-pull workflow. Never copy credentials between environments.",
      ),
  })
  return new Map(
    source
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const index = line.indexOf("=")
        const raw = line.slice(index + 1).trim()
        const value =
          (raw.startsWith('"') && raw.endsWith('"')) ||
          (raw.startsWith("'") && raw.endsWith("'"))
            ? raw.slice(1, -1)
            : raw
        return [line.slice(0, index), value] as const
      }),
  )
})

const neonRead = (
  projectId: string,
  resource: "branches" | "endpoints",
  root: string,
) =>
  providerRead(
    "neon",
    [
      "api",
      `/projects/${projectId}/${resource}`,
      "--method",
      "GET",
      "--output",
      "json",
    ],
    root,
  )

export const resolveTarget = Effect.fn("Meridian.resolveTarget")(function* (
  environment: "local" | "staging",
  root: string,
  projectId?: string,
) {
  yield* checkRuntime(environment, process.env)
  if (environment === "local") {
    yield* loadApiEnvironment
    return {
      url: yield* readLocalDevelopmentDatabaseUrl().pipe(
        Effect.mapError(() =>
          refuse(
            "The checkout-owned local Compose database could not be verified. Run dev:setup and infra doctor.",
          ),
        ),
      ),
      dashboard: "http://localhost:3001",
    }
  }
  if (!projectId || !/^[a-z0-9-]+$/.test(projectId)) {
    return yield* refuse(
      "Specify the existing Pulumi-managed Neon project ID for read-only identity verification.",
    )
  }
  const sources = yield* Effect.all(
    [".env.neon.staging", ".env.neon", ".env.neon.preview"].map((name) =>
      readEnv(resolve(root, "packages/db", name)),
    ),
  )
  const url = yield* checkStagingUrls(sources[0]!, sources[1]!, sources[2]!)
  const inventory = yield* Effect.all([
    neonRead(projectId, "branches", root),
    neonRead(projectId, "endpoints", root),
  ])
  yield* checkNeonIdentity(url.hostname, projectId, inventory[0], inventory[1])
  return { url: url.href, dashboard: "https://app.staging.flowmark.dev" }
})
