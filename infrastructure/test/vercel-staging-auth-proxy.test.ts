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

test("proxy secret adoption/versioning affects only the two protected Staging bindings", async () => {
  const config: Record<string, string> = {
    importVercelBindings: "true",
    importStagingAuthProxyBindings: "true",
    stagingAuthProxySecret: "synthetic-staging-proxy-secret",
    stagingAuthProxySecretVersion: "1",
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
  const names: string[] = []
  for (const stage of ["preview", "staging"]) {
    for (const key of [
      "database-url",
      "better-auth-secret",
      "better-auth-url",
      "flowmark-dashboard-origin",
      "flowmark-database-branch",
    ])
      names.push(`api-${stage}-${key}`)
  }
  names.push(
    "dashboard-preview-flowmark-vercel-protection-bypass",
    "dashboard-staging-flowmark-api-url",
    "web-staging-next-public-flowmark-app-url",
  )
  names.push(
    "api-staging-flowmark-auth-proxy-secret",
    "dashboard-staging-flowmark-auth-proxy-secret",
  )
  for (const name of names) {
    config[`${name}-id`] = `env-${name}`
    config[`${name}-value`] = "https://fixture.example.test"
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
    (r) =>
      r.type ===
      "vercel:index/projectEnvironmentVariable:ProjectEnvironmentVariable",
  )
  assert.equal(bindings.length, 15)
  const proxy = bindings.filter(
    (r) => r.inputs.key === "FLOWMARK_AUTH_PROXY_SECRET",
  )
  assert.equal(proxy.length, 2)
  for (const binding of proxy) {
    assert.deepEqual(binding.inputs.targets, ["preview"])
    assert.equal(binding.inputs.gitBranch, "staging")
    assert.equal(binding.inputs.sensitive, true)
    assert.equal(binding.inputs.visibility, "secret")
    assert.equal(binding.inputs.value, undefined)
    assert.ok(binding.inputs.valueWo)
    assert.equal(binding.inputs.valueWoVersion, 1)
    assert.ok(binding.id?.startsWith("write-only:team_fixture/prj_"))
    assert.ok(["prj_api", "prj_dashboard"].includes(binding.inputs.projectId))
  }
  for (const binding of bindings.filter(
    (r) => r.inputs.key !== "FLOWMARK_AUTH_PROXY_SECRET",
  )) {
    assert.equal(binding.inputs.valueWoVersion, undefined)
  }
})
