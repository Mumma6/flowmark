import assert from "node:assert/strict"
import { test } from "node:test"
import {
  deployRelease,
  deploymentConfiguration,
  deploymentPreflight,
  releaseProjects,
} from "./release-deployment.mjs"

const sha = "a".repeat(40)
const env = {
  GITHUB_ACTIONS: "true",
  FLOWMARK_RELEASE_PIPELINE_ENABLED: "true",
  GITHUB_REPOSITORY: "Mumma6/flowmark",
  GITHUB_REF_NAME: "staging",
  GITHUB_SHA: sha,
  VERCEL_TOKEN: "test-only-token",
  VERCEL_ORG_ID: "team_test",
  ...Object.fromEntries(
    releaseProjects.map((p) => [`VERCEL_${p.key}_PROJECT_ID`, `prj_${p.key}`]),
  ),
}
function fixture(overrides = {}, fail = () => false) {
  const target = { ...env, ...overrides }
  const calls = []
  const run = (command, args, child = target) => {
    calls.push({ command, args, env: child })
    if (fail(command, args)) {
      throw new Error("Simulated deployment failure")
    }
    if (command === "git") {
      return args[0] === "rev-parse" ? sha : target.GITHUB_REF_NAME
    }
    if (args[0] === "api" && args[1].startsWith("/v9/projects/")) {
      const project = releaseProjects.find((p) =>
        args[1].endsWith(`prj_${p.key}`),
      )
      return JSON.stringify({
        id: `prj_${project.key}`,
        name: project.name,
        rootDirectory: project.root,
        accountId: "team_test",
      })
    }
    if (args[0] === "deploy") {
      assert.ok(args.includes("--json"))
      return JSON.stringify({
        url: `https://${child.VERCEL_PROJECT_ID.toLowerCase()}.vercel.app`,
      })
    }
    if (args[0] === "api" && args[1].startsWith("/v13/deployments/")) {
      return JSON.stringify({
        id: `dpl_${child.VERCEL_PROJECT_ID}`,
        projectId: child.VERCEL_PROJECT_ID,
        readyState: "READY",
        target: target.GITHUB_REF_NAME === "main" ? "production" : null,
        meta: { githubCommitSha: sha },
      })
    }
    if (args[0] === "curl" && args[1] === "/api/health") {
      return JSON.stringify({
        status: "ok",
        service: "flowmark-api",
        commit: sha,
      })
    }
    return "ok"
  }
  return { target, run, calls }
}

test("preflight never deploys and refuses missing activation, wrong repo or duplicate projects", () => {
  const f = fixture()
  deploymentPreflight(f.target, f.run)
  assert.equal(f.calls.filter((c) => c.args[0] === "api").length, 4)
  assert.ok(!f.calls.some((c) => c.args[0] === "deploy"))
  for (const overrides of [
    { FLOWMARK_RELEASE_PIPELINE_ENABLED: "false" },
    { GITHUB_REPOSITORY: "other/repo" },
    { GITHUB_REF_NAME: "feature" },
    { VERCEL_WEB_PROJECT_ID: "prj_API" },
    { VERCEL_TOKEN: "" },
  ]) {
    assert.throws(() => deploymentConfiguration({ ...env, ...overrides }))
  }
})
test("staging deploys API first and verifies before assigning its canonical alias", () => {
  const f = fixture()
  const result = deployRelease(f.target, f.run)
  assert.equal(result.deployed.length, 4)
  const deploys = f.calls.filter((c) => c.args[0] === "deploy")
  assert.deepEqual(
    deploys.map((c) => c.env.VERCEL_PROJECT_ID),
    releaseProjects.map((p) => `prj_${p.key}`),
  )
  assert.ok(
    deploys.every(
      (c) => !c.args.includes("--skip-domain") && !c.args.includes("--token"),
    ),
  )
  const smoke = f.calls.findIndex((c) => c.args[0] === "curl")
  const alias = f.calls.findIndex((c) => c.args[0] === "alias")
  assert.ok(smoke < alias)
  assert.ok(
    f.calls.some((c) =>
      c.args.some((arg) => arg.includes("api.staging.flowmark.dev")),
    ),
  )
  assert.ok(!f.calls.some((c) => c.args[0] === "promote"))
})
test("production verifies staged builds before promoting, with no preview promotion", () => {
  const f = fixture({ GITHUB_REF_NAME: "main" })
  deployRelease(f.target, f.run)
  assert.ok(
    f.calls
      .filter((c) => c.args[0] === "deploy")
      .every(
        (c) =>
          c.args.includes("--skip-domain") && c.args.includes("production"),
      ),
  )
  assert.equal(f.calls.filter((c) => c.args[0] === "promote").length, 4)
  assert.ok(
    f.calls.findIndex((c) => c.args[0] === "curl") <
      f.calls.findIndex((c) => c.args[0] === "promote"),
  )
})
test("failed API smoke stops promotion and later projects", () => {
  const f = fixture(
    { GITHUB_REF_NAME: "main" },
    (_, args) => args[0] === "curl",
  )
  assert.throws(
    () => deployRelease(f.target, f.run),
    /Simulated deployment failure/,
  )
  assert.equal(f.calls.filter((c) => c.args[0] === "deploy").length, 1)
  assert.ok(!f.calls.some((c) => c.args[0] === "promote"))
})
test("wrong deployment SHA, project or readiness stops rollout", () => {
  for (const patch of [
    { projectId: "prj_other" },
    { readyState: "ERROR" },
    { meta: { githubCommitSha: "b".repeat(40) } },
  ]) {
    const f = fixture()
    const run = (command, args, child) => {
      const response = f.run(command, args, child)
      return args[0] === "api" && args[1].startsWith("/v13/deployments/")
        ? JSON.stringify({ ...JSON.parse(response), ...patch })
        : response
    }
    assert.throws(() => deployRelease(f.target, run))
    assert.ok(!f.calls.some((c) => c.args[0] === "alias"))
  }
})
test("canonical alias mismatch is a failed rollout, never a success-shaped fallback", () => {
  const f = fixture()
  const run = (command, args, child) => {
    const response = f.run(command, args, child)
    return args[0] === "api" &&
      args[1] === "/v13/deployments/api.staging.flowmark.dev"
      ? JSON.stringify({ ...JSON.parse(response), id: "dpl_other" })
      : response
  }
  assert.throws(() => deployRelease(f.target, run))
})

test("a healthy response from the wrong API revision is not accepted", () => {
  const f = fixture({ GITHUB_REF_NAME: "main" })
  const run = (command, args, child) => {
    const response = f.run(command, args, child)
    return args[0] === "curl" && args[1] === "/api/health"
      ? JSON.stringify({
          status: "ok",
          service: "flowmark-api",
          commit: "b".repeat(40),
        })
      : response
  }
  assert.throws(
    () => deployRelease(f.target, run),
    /API health\/revision check failed/,
  )
  assert.ok(!f.calls.some((c) => c.args[0] === "promote"))
  assert.equal(f.calls.filter((c) => c.args[0] === "deploy").length, 1)
})

test("accepts the pinned CLI's non-interactive JSON envelope", () => {
  const f = fixture()
  const run = (command, args, child) => {
    const output = f.run(command, args, child)
    return args[0] === "deploy"
      ? JSON.stringify({ status: "ok", deployment: JSON.parse(output) })
      : output
  }
  assert.equal(deployRelease(f.target, run).deployed.length, 4)
})

test("refuses CLI error or missing URL before deployment verification and aliases", () => {
  for (const output of [
    { status: "error", deployment: { url: "https://wrong.vercel.app" } },
    { status: "ok", deployment: {} },
  ]) {
    const f = fixture()
    const run = (command, args, child) =>
      args[0] === "deploy"
        ? JSON.stringify(output)
        : f.run(command, args, child)
    assert.throws(() => deployRelease(f.target, run))
    assert.ok(
      !f.calls.some((c) => ["curl", "alias", "promote"].includes(c.args[0])),
    )
  }
})
