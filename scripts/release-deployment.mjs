import { spawnSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import process from "node:process"
import console from "node:console"
import { pathToFileURL, URL } from "node:url"

export const releaseProjects = [
  {
    key: "API",
    name: "flowmark-api",
    root: "apps/server",
    path: "/api/health",
    production: "api.flowmark.dev",
    staging: "api.staging.flowmark.dev",
  },
  {
    key: "DASHBOARD",
    name: "flowmark-dashboard",
    root: "apps/dashboard",
    path: "/",
    production: "app.flowmark.dev",
    staging: "app.staging.flowmark.dev",
  },
  {
    key: "DOCS",
    name: "flowmark-docs",
    root: "apps/docs",
    path: "/",
    production: "docs.flowmark.dev",
  },
  {
    key: "WEB",
    name: "flowmark-web",
    root: "apps/web",
    path: "/",
    production: "flowmark.dev",
  },
]
const scope = ["--scope", "mumma6s-projects"]
const requireValue = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

export function deploymentConfiguration(env) {
  requireValue(
    env.GITHUB_ACTIONS === "true" &&
      env.FLOWMARK_RELEASE_PIPELINE_ENABLED === "true",
    "Release pipeline is not activated; see docs/migrations.md.",
  )
  requireValue(
    env.GITHUB_REPOSITORY === "Mumma6/flowmark" &&
      ["main", "staging"].includes(env.GITHUB_REF_NAME),
    "Only this repository's main/staging branches can deploy.",
  )
  requireValue(
    /^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? ""),
    "An exact commit is required.",
  )
  requireValue(
    env.VERCEL_TOKEN && /^team_/.test(env.VERCEL_ORG_ID ?? ""),
    "Configure environment-scoped Vercel credentials.",
  )
  const projects = releaseProjects.map((project) => ({
    ...project,
    id: env[`VERCEL_${project.key}_PROJECT_ID`],
  }))
  requireValue(
    projects.every((p) => /^prj_[a-zA-Z0-9]+$/.test(p.id ?? "")) &&
      new Set(projects.map((p) => p.id)).size === 4,
    "Configure four distinct existing Vercel project IDs.",
  )
  return {
    projects,
    branch: env.GITHUB_REF_NAME,
    sha: env.GITHUB_SHA,
    production: env.GITHUB_REF_NAME === "main",
  }
}

export function verifyDeployment(record, project, config) {
  requireValue(
    record.projectId === project.id && record.readyState === "READY",
    "Deployment must be READY in the intended project.",
  )
  requireValue(
    (record.gitSource?.sha ??
      record.gitMetadata?.commitSha ??
      record.meta?.githubCommitSha) === config.sha,
    "Deployment commit does not match the reviewed release.",
  )
  requireValue(
    config.production
      ? record.target === "production"
      : record.target == null || record.target === "preview",
    "Deployment environment mismatch.",
  )
  requireValue(
    typeof record.id === "string" && record.id.startsWith("dpl_"),
    "Missing deployment identity.",
  )
}

// All projects are checked before the first deploy; API is deployed/promoted first.
export function deploymentPreflight(env, run) {
  const config = deploymentConfiguration(env)
  requireValue(
    run("git", ["rev-parse", "HEAD"]).trim() === config.sha &&
      run("git", ["branch", "--show-current"]).trim() === config.branch,
    "Checkout must match the push SHA and branch.",
  )
  for (const project of config.projects) {
    const remote = JSON.parse(
      run("vercel", ["api", `/v9/projects/${project.id}`, ...scope]),
    )
    requireValue(
      remote.id === project.id &&
        remote.name === project.name &&
        remote.rootDirectory === project.root &&
        remote.accountId === env.VERCEL_ORG_ID,
      "Vercel project/team/root mismatch; refusing deployment.",
    )
  }
  return config
}

export function deployRelease(env, run, onDeployed = () => {}) {
  const config = deploymentPreflight(env, run)
  const deployed = []
  for (const project of config.projects) {
    const childEnv = { ...env, VERCEL_PROJECT_ID: project.id }
    const output = JSON.parse(
      run(
        "vercel",
        [
          "deploy",
          "--json",
          "--yes",
          "--project",
          project.id,
          "--environment",
          config.production ? "production" : "preview",
          ...scope,
          "--build-env",
          "FLOWMARK_CONTROLLED_DEPLOY=true",
          "--env",
          `FLOWMARK_DEPLOYMENT_SHA=${config.sha}`,
          "--meta",
          `githubCommitRef=${config.branch}`,
          "--meta",
          `githubCommitSha=${config.sha}`,
          ...(config.production ? ["--skip-domain"] : []),
        ],
        childEnv,
      ),
    )
    requireValue(
      output.status === undefined || output.status === "ok",
      "Deployment command did not report success.",
    )
    const url = (output.deployment ?? output).url
    const parsed = new URL(url)
    requireValue(
      parsed.protocol === "https:" &&
        parsed.origin === url &&
        parsed.hostname.endsWith(".vercel.app") &&
        !parsed.username,
      "Invalid deployment URL.",
    )
    const record = JSON.parse(
      run(
        "vercel",
        ["api", `/v13/deployments/${parsed.hostname}`, ...scope],
        childEnv,
      ),
    )
    verifyDeployment(record, project, config)
    const smoke = run(
      "vercel",
      [
        "curl",
        project.path,
        "--deployment",
        url,
        ...scope,
        "--",
        "--fail",
        "--location",
        "--silent",
        "--show-error",
        "--max-time",
        "45",
      ],
      childEnv,
    )
    if (project.key === "API") {
      const health = JSON.parse(smoke)
      requireValue(
        health.status === "ok" &&
          health.service === "flowmark-api" &&
          health.commit === config.sha,
        "API health/revision check failed.",
      )
    }
    const canonical = config.production ? project.production : project.staging
    if (config.production) {
      run("vercel", ["promote", url, "--yes", ...scope], childEnv)
    } else if (canonical) {
      run("vercel", ["alias", "set", url, canonical, ...scope], childEnv)
    }
    if (canonical) {
      const current = JSON.parse(
        run(
          "vercel",
          ["api", `/v13/deployments/${canonical}`, ...scope],
          childEnv,
        ),
      )
      verifyDeployment(current, project, config)
      requireValue(
        current.id === record.id,
        "Canonical domain does not point to the verified deployment.",
      )
      run(
        "vercel",
        [
          "curl",
          project.path,
          "--deployment",
          `https://${canonical}`,
          ...scope,
          "--",
          "--fail",
          "--location",
          "--silent",
          "--show-error",
          "--max-time",
          "45",
        ],
        childEnv,
      )
    }
    const verified = {
      project: project.name,
      url,
      id: record.id,
      canonical: canonical ?? null,
    }
    deployed.push(verified)
    onDeployed(verified)
  }
  return {
    environment: config.production ? "production" : "staging",
    sha: config.sha,
    deployed,
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const run = (command, args, env = process.env) => {
    const result = spawnSync(command, args, {
      env,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    })
    if (result.status !== 0) {
      throw new Error(
        `Release command failed (${command}); stopping without automatic rollback.`,
      )
    }
    return result.stdout
  }
  try {
    if (process.argv.includes("--preflight")) {
      deploymentPreflight(process.env, run)
      console.log("Release project, revision and credential preflight passed.")
      process.exit(0)
    }
    const result = deployRelease(process.env, run, (project) => {
      const progress = `- Verified ${project.project}: ${project.url}${project.canonical ? ` → https://${project.canonical}` : ""}\n`
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, progress)
      }
      console.log(`Verified ${project.project}`)
    })
    const summary = `### Deployment verification\n\nEnvironment: ${result.environment}\n\nCommit: ${result.sha}\n\n${result.deployed.map((p) => `- ${p.project}: ${p.url}${p.canonical ? ` → https://${p.canonical}` : ""}`).join("\n")}\n\nVerified readiness, commit, target, HTTP response and canonical aliases. Functional auth/ingestion smoke tests remain part of release acceptance.\n`
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
    }
    console.log(summary)
  } catch {
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        "\nRollout failed. Earlier verified projects may already serve this revision; inspect state before retrying. No automatic rollback.\n",
      )
    }
    console.error(
      "Release rollout failed. Stopping without automatic rollback; inspect the reviewed revision and deployment state before retrying.",
    )
    process.exitCode = 1
  }
}
