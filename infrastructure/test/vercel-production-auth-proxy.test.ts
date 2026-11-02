import assert from "node:assert/strict"
import test from "node:test"
import * as pulumi from "@pulumi/pulumi"
import * as vercel from "@pulumiverse/vercel"
import type { MockResourceArgs } from "@pulumi/pulumi/runtime"
import { manageProductionAuthProxyBindings } from "../vercel-production-auth-proxy"

const registered: MockResourceArgs[] = []
pulumi.runtime.setMocks(
  {
    newResource: (args) => {
      registered.push(args)
      return { id: args.id || args.name, state: args.inputs }
    },
    call: ({ inputs }) => inputs,
  },
  "flowmark-infrastructure",
  "production",
  false,
)
const provider = new vercel.Provider("fixture", {})
const configure = (overrides: Record<string, string>) =>
  pulumi.runtime.setAllConfig(
    Object.fromEntries(
      Object.entries(overrides).map(([key, value]) => [
        `flowmark-infrastructure:${key}`,
        value,
      ]),
    ),
  )

test("Production proxy provisioning is independently opt-in", () => {
  configure({})
  assert.deepEqual(manageProductionAuthProxyBindings(provider), [])
})

test("Production proxy provisioning requires an explicit positive integer version", () => {
  for (const version of [undefined, "0", "-1", "1.5"]) {
    configure({
      manageProductionAuthProxyBindings: "true",
      ...(version ? { productionAuthProxySecretVersion: version } : {}),
    })
    assert.throws(() => manageProductionAuthProxyBindings(provider))
  }
})

test("Production proxy provisioning rejects a short secret before registering bindings", () => {
  configure({
    manageProductionAuthProxyBindings: "true",
    productionAuthProxySecretVersion: "1",
    productionAuthProxySecret: "too-short",
  })
  assert.throws(() => manageProductionAuthProxyBindings(provider))
  assert.equal(
    registered.filter((r) => r.type.includes("projectEnvironmentVariable"))
      .length,
    0,
  )
})

test(
  "Production proxy provisioning creates only two Production-only write-only bindings",
  { timeout: 5000 },
  async () => {
    configure({
      manageProductionAuthProxyBindings: "true",
      productionAuthProxySecretVersion: "1",
      productionAuthProxySecret: "synthetic-production-proxy-secret-for-tests",
      vercelTeamId: "team_fixture",
      vercelApiProjectId: "prj_api",
      vercelDashboardProjectId: "prj_dashboard",
    })
    await new Promise<void>((resolve) =>
      pulumi
        .all(manageProductionAuthProxyBindings(provider))
        .apply(() => resolve()),
    )
    const bindings = registered.filter((r) =>
      r.type.includes("projectEnvironmentVariable"),
    )
    assert.equal(bindings.length, 2)
    assert.deepEqual(bindings.map((r) => r.inputs.projectId).sort(), [
      "prj_api",
      "prj_dashboard",
    ])
    for (const binding of bindings) {
      assert.ok(!binding.id)
      assert.equal(binding.inputs.key, "FLOWMARK_AUTH_PROXY_SECRET")
      assert.equal(binding.inputs.teamId, "team_fixture")
      assert.deepEqual(binding.inputs.targets, ["production"])
      assert.equal(binding.inputs.gitBranch, undefined)
      assert.equal(binding.inputs.sensitive, true)
      assert.equal(binding.inputs.visibility, "secret")
      assert.equal(binding.inputs.value, undefined)
      assert.ok(binding.inputs.valueWo)
      assert.equal(binding.inputs.valueWoVersion, 1)
    }
    assert.deepEqual(bindings[0].inputs.valueWo, bindings[1].inputs.valueWo)
  },
)
