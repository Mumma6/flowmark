import { Effect } from "effect"
import {
  PreviewAuthOriginError,
  PreviewDashboardApiError,
  PreviewDatabaseError,
} from "./error.js"

const productionPublicHosts = new Set([
  "flowmark.dev",
  "www.flowmark.dev",
  "app.flowmark.dev",
  "api.flowmark.dev",
  "docs.flowmark.dev",
])

// Stable production aliases. A preview git alias
// (`flowmark-api-git-<branch>-…`) is not in this set.
const productionDeploymentHosts = new Set([
  "flowmark-api.vercel.app",
  "flowmark-api-mumma6s-projects.vercel.app",
  "flowmark-api-git-main-mumma6s-projects.vercel.app",
  "flowmark-dashboard.vercel.app",
  "flowmark-dashboard-mumma6s-projects.vercel.app",
  "flowmark-dashboard-git-main-mumma6s-projects.vercel.app",
])

const previewApiLabelPrefix = "flowmark-api-git-"
const previewDashboardLabelPrefix = "flowmark-dashboard-git-"
const previewLabelSuffix = "-mumma6s-projects"

export function isProductionPublicHost(hostname: string): boolean {
  return productionPublicHosts.has(hostname.toLowerCase())
}

export function isProductionDeploymentHost(hostname: string): boolean {
  return productionDeploymentHosts.has(hostname.toLowerCase())
}

export function isProductionHost(hostname: string): boolean {
  return (
    isProductionPublicHost(hostname) || isProductionDeploymentHost(hostname)
  )
}

// Hobby has no Custom Environments, so the staging git branch still runs as
// VERCEL_ENV=preview. Its *.vercel.app aliases stay behind deployment
// protection, so this branch uses pinned custom origins instead of the
// generated preview alias.
export const stagingGitBranch = "staging"
export const stagingDashboardOrigin = "https://app.staging.flowmark.dev"
export const stagingApiOrigin = "https://api.staging.flowmark.dev"

const stagingHosts = new Set([
  "app.staging.flowmark.dev",
  "api.staging.flowmark.dev",
])

export function isStagingGitBranch(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.VERCEL_GIT_COMMIT_REF === stagingGitBranch
}

export function isStagingHost(hostname: string): boolean {
  return stagingHosts.has(hostname.toLowerCase())
}

export function vercelPreviewBranchSlug(
  ref: string,
  labelPrefix: string,
): string | undefined {
  const slug = ref
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!slug) {
    return undefined
  }
  const max = 63 - labelPrefix.length - previewLabelSuffix.length
  return slug.slice(0, max).replace(/-+$/g, "") || undefined
}

const previewDeploymentOrigin = (
  env: NodeJS.ProcessEnv,
  labelPrefix: string,
) => {
  if (!isPreviewRuntime(env) || isStagingGitBranch(env)) {
    return undefined
  }
  const ref = env.VERCEL_GIT_COMMIT_REF
  if (!ref) {
    return undefined
  }
  const slug = vercelPreviewBranchSlug(ref, labelPrefix)
  if (!slug) {
    return undefined
  }
  return `https://${labelPrefix}${slug}${previewLabelSuffix}.vercel.app`
}

export function previewApiOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return previewDeploymentOrigin(env, previewApiLabelPrefix)
}

export function previewDashboardOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return previewDeploymentOrigin(env, previewDashboardLabelPrefix)
}

export function isPreviewRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.VERCEL_ENV === "preview"
}

const hostnameFrom = <E>(url: string, error: E) =>
  Effect.try({
    try: () => new URL(url).hostname,
    catch: () => error,
  })

const isolatedDatabaseBranch = (env: NodeJS.ProcessEnv) =>
  isStagingGitBranch(env) ? stagingGitBranch : "preview"

export const assertPreviewDatabase = Effect.fn("assertPreviewDatabase")(
  function* (url: string | undefined, env: NodeJS.ProcessEnv = process.env) {
    if (!isPreviewRuntime(env)) {
      return
    }
    const branch = isolatedDatabaseBranch(env)
    if (env.FLOWMARK_DATABASE_BRANCH !== branch) {
      return yield* new PreviewDatabaseError({
        reason:
          branch === "staging"
            ? "Refusing staging database: FLOWMARK_DATABASE_BRANCH must be staging on the staging git branch."
            : "Refusing preview database: FLOWMARK_DATABASE_BRANCH must be preview on the isolated preview env record.",
      })
    }
    if (!url) {
      return yield* new PreviewDatabaseError({
        reason: `Refusing ${branch} database: DATABASE_URL is required.`,
      })
    }
    const host = yield* hostnameFrom(
      url,
      new PreviewDatabaseError({
        reason: `Refusing ${branch} database: DATABASE_URL is not a valid URL.`,
      }),
    )
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      !host.endsWith(".neon.tech")
    ) {
      return yield* new PreviewDatabaseError({
        reason: `Refusing ${branch} database: host ${host} is not a Neon host.`,
      })
    }
    if (isProductionHost(host)) {
      return yield* new PreviewDatabaseError({
        reason: `Refusing ${branch} database: host ${host} is a production host.`,
      })
    }
  },
)

const exactHttpsOrigin = (value: string, expected: string) => {
  const url = new URL(value)
  return (
    url.origin === expected &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "" &&
    url.username === "" &&
    url.password === ""
  )
}

export const assertPreviewAuthOrigins = Effect.fn("assertPreviewAuthOrigins")(
  function* (env: NodeJS.ProcessEnv = process.env) {
    if (!isPreviewRuntime(env)) {
      return
    }
    if (isStagingGitBranch(env)) {
      for (const value of [
        env.BETTER_AUTH_URL,
        env.FLOWMARK_DASHBOARD_ORIGIN,
      ]) {
        if (!value) {
          return yield* new PreviewAuthOriginError({
            reason: `Refusing staging auth: BETTER_AUTH_URL and FLOWMARK_DASHBOARD_ORIGIN must both be ${stagingDashboardOrigin}.`,
          })
        }
        const exact = yield* Effect.try({
          try: () => exactHttpsOrigin(value, stagingDashboardOrigin),
          catch: () =>
            new PreviewAuthOriginError({
              reason: "Refusing staging auth: an origin is not a valid URL.",
            }),
        })
        if (!exact) {
          return yield* new PreviewAuthOriginError({
            reason: `Refusing staging auth: BETTER_AUTH_URL and FLOWMARK_DASHBOARD_ORIGIN must both be ${stagingDashboardOrigin}.`,
          })
        }
      }
      return
    }
    const baseUrl = env.BETTER_AUTH_URL
    const dashboardOrigin = env.FLOWMARK_DASHBOARD_ORIGIN
    if (!baseUrl || !dashboardOrigin) {
      return yield* new PreviewAuthOriginError({
        reason:
          "Refusing preview auth: BETTER_AUTH_URL and FLOWMARK_DASHBOARD_ORIGIN must be set, and neither may be a production host.",
      })
    }
    for (const value of [baseUrl, dashboardOrigin]) {
      const host = yield* hostnameFrom(
        value,
        new PreviewAuthOriginError({
          reason: "Refusing preview auth: an origin is not a valid URL.",
        }),
      )
      if (isProductionHost(host) || isStagingHost(host)) {
        return yield* new PreviewAuthOriginError({
          reason: `Refusing preview auth: ${host} is not a preview host.`,
        })
      }
    }
  },
)

export const assertPreviewDashboardApi = Effect.fn("assertPreviewDashboardApi")(
  function* (url: string | undefined, env: NodeJS.ProcessEnv = process.env) {
    if (!isPreviewRuntime(env)) {
      return
    }
    if (isStagingGitBranch(env)) {
      if (!url) {
        return yield* new PreviewDashboardApiError({
          reason: `Refusing staging dashboard: FLOWMARK_API_URL must be ${stagingApiOrigin}.`,
        })
      }
      const exact = yield* Effect.try({
        try: () => exactHttpsOrigin(url, stagingApiOrigin),
        catch: () =>
          new PreviewDashboardApiError({
            reason:
              "Refusing staging dashboard: FLOWMARK_API_URL is not a valid URL.",
          }),
      })
      if (!exact) {
        return yield* new PreviewDashboardApiError({
          reason: `Refusing staging dashboard: FLOWMARK_API_URL must be ${stagingApiOrigin}.`,
        })
      }
      return
    }
    if (!url) {
      return yield* new PreviewDashboardApiError({
        reason:
          "Refusing preview dashboard: FLOWMARK_API_URL is required and must not target the production API.",
      })
    }
    const host = yield* hostnameFrom(
      url,
      new PreviewDashboardApiError({
        reason:
          "Refusing preview dashboard: FLOWMARK_API_URL is not a valid URL.",
      }),
    )
    if (isProductionHost(host) || isStagingHost(host)) {
      return yield* new PreviewDashboardApiError({
        reason: `Refusing preview dashboard: ${host} is not a preview host.`,
      })
    }
  },
)
