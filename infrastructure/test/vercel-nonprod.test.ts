import assert from "node:assert/strict"
import test from "node:test"
import * as pulumi from "@pulumi/pulumi"
import type { MockResourceArgs } from "@pulumi/pulumi/runtime"
import { importNonprodVercelBindings } from "../vercel-nonprod"

const registered: MockResourceArgs[] = []
pulumi.runtime.setMocks(
  {
    newResource: (args) => {
      registered.push(args)
      return { id: args.id ?? args.name, state: args.inputs }
    },
    call: ({ inputs }) => inputs,
  },
  "flowmark-infrastructure",
  "nonprod",
  true,
)

test("Vercel adoption stays disabled until explicitly configured", () => {
  pulumi.runtime.setAllConfig({})
  assert.deepEqual(importNonprodVercelBindings(), [])
})

test("nonprod bindings use explicit import IDs and only Preview targets", async () => {
  const config: Record<string, string> = {
    importVercelBindings: "true",
    vercelTeamId: "team_fixture",
    vercelApiProjectId: "prj_api",
    vercelDashboardProjectId: "prj_dashboard",
    vercelWebProjectId: "prj_web",
    previewDatabaseUrl: "postgres://fixture-preview",
    stagingDatabaseUrl: "postgres://fixture-staging",
    previewBetterAuthSecret: "fixture-preview-secret",
    stagingBetterAuthSecret: "fixture-staging-secret",
    previewProtectionBypass: "fixture-bypass",
  }
  const expected: Record<string, { project: string; stage: string }> = {}
  for (const stage of ["preview", "staging"]) {
    for (const key of [
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "FLOWMARK_DASHBOARD_ORIGIN",
      "FLOWMARK_DATABASE_BRANCH",
    ]) {
      expected[`api-${stage}-${key.toLowerCase().replaceAll("_", "-")}`] = {
        project: "api",
        stage,
      }
    }
  }
  expected["dashboard-preview-flowmark-vercel-protection-bypass"] = {
    project: "dashboard",
    stage: "preview",
  }
  expected["dashboard-staging-flowmark-api-url"] = {
    project: "dashboard",
    stage: "staging",
  }
  expected["web-staging-next-public-flowmark-app-url"] = {
    project: "web",
    stage: "staging",
  }
  for (const name of Object.keys(expected)) {
    config[`${name}-id`] = `env-${name}`
    config[`${name}-value`] = "https://nonprod.example.test"
  }
  pulumi.runtime.setAllConfig(
    Object.fromEntries(
      Object.entries(config).map(([key, value]) => [
        `flowmark-infrastructure:${key}`,
        value,
      ]),
    ),
  )

  const ids = importNonprodVercelBindings()
  await new Promise<void>((resolve) => {
    pulumi.all(ids).apply(() => resolve())
  })

  const bindings = registered.filter(
    ({ type }) =>
      type ===
      "vercel:index/projectEnvironmentVariable:ProjectEnvironmentVariable",
  )
  assert.equal(bindings.length, 13)
  for (const binding of bindings) {
    const expectedBinding = expected[binding.name]
    assert.ok(expectedBinding)
    assert.equal(
      binding.id,
      `${binding.inputs.sensitive ? "write-only:" : ""}team_fixture/prj_${expectedBinding.project}/env-${binding.name}`,
    )
    if (binding.inputs.sensitive) {
      assert.equal(binding.inputs.value, undefined)
      assert.ok(binding.inputs.valueWo)
      assert.equal(binding.inputs.valueWoVersion, undefined)
    }
    assert.deepEqual(binding.inputs.targets, ["preview"])
    assert.equal(
      binding.inputs.gitBranch,
      expectedBinding.stage === "staging" ? "staging" : undefined,
    )
    assert.equal(binding.inputs.teamId, "team_fixture")
    assert.equal(binding.inputs.projectId, `prj_${expectedBinding.project}`)
  }
})
