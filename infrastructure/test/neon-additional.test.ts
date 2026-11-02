import assert from "node:assert/strict"
import test from "node:test"
import * as pulumi from "@pulumi/pulumi"
import type { MockResourceArgs } from "@pulumi/pulumi/runtime"
import { importProductionNeon } from "../neon-additional"
import { importNonprodBranches } from "../nonprod"

const registered: MockResourceArgs[] = []
let resolveRegistrations = () => {}
const allRegistered = new Promise<void>((resolve) => {
  resolveRegistrations = resolve
})
pulumi.runtime.setMocks(
  {
    newResource: (args) => {
      registered.push(args)
      if (registered.length === 15) {
        resolveRegistrations()
      }
      const id =
        args.type === "neon:index/branch:Branch"
          ? args.id?.split("/")[1]
          : (args.id ?? args.name)
      return { id, state: args.inputs }
    },
    call: ({ inputs }) => inputs,
  },
  "flowmark-infrastructure",
  "production",
  true,
)

const configure = (config: Record<string, string>) =>
  pulumi.runtime.setAllConfig(
    Object.fromEntries(
      Object.entries(config).map(([k, v]) => [
        `flowmark-infrastructure:${k}`,
        v,
      ]),
    ),
  )
const settle = async (ids: pulumi.Output<string>[]) => {
  await new Promise<void>((resolve) => pulumi.all(ids).apply(() => resolve()))
  await new Promise((resolve) => setImmediate(resolve))
}

test("production Neon adoption remains opt-in", () => {
  configure({})
  assert.deepEqual(importProductionNeon(), [])
  assert.equal(registered.length, 0)
})

test(
  "persistent branches adopt computes, database containers and owners without creation inputs",
  { timeout: 5000 },
  async () => {
    const config: Record<string, string> = {
      importProductionNeon: "true",
      importNeonBranchResources: "true",
      neonProjectId: "project_fixture",
      neonOrgId: "org_fixture",
    }
    for (const stage of ["production", "preview", "staging"]) {
      config[`${stage}BranchId`] = `br-${stage}`
      config[`${stage}EndpointId`] = `ep-${stage}`
      config[`${stage}DatabaseName`] = "neondb"
      config[`${stage}DatabaseOwnerRole`] = "neondb_owner"
    }
    configure(config)
    await settle(importProductionNeon())
    await settle(importNonprodBranches())
    await allRegistered
    const resources = registered.filter(
      (r) => !r.type.startsWith("pulumi:providers:"),
    )
    assert.equal(resources.length, 13)
    assert.equal(
      resources.filter((r) => r.type === "neon:index/project:Project").length,
      1,
    )
    for (const type of ["Branch", "Endpoint", "Database", "Role"]) {
      assert.equal(
        resources.filter(
          (r) => r.type === `neon:index/${type.toLowerCase()}:${type}`,
        ).length,
        3,
      )
    }
    assert.ok(
      resources.every((r) => r.id),
      "every resource must have an explicit import identity",
    )
    for (const r of resources) {
      assert.equal(r.inputs.projectId ?? r.id, "project_fixture")
      assert.equal(r.inputs.parentId, undefined)
      assert.equal(r.inputs.parentTimestamp, undefined)
      assert.equal(r.inputs.protected, undefined)
      assert.equal(r.inputs.password, undefined)
      if (r.type === "neon:index/endpoint:Endpoint") {
        assert.equal(
          r.id,
          `project_fixture/ep-${r.inputs.branchId.replace("br-", "")}`,
        )
        assert.equal(r.inputs.suspendTimeoutSeconds, 0)
        assert.equal(r.inputs.autoscalingLimitMaxCu, 2)
        assert.equal(r.inputs.disabled, false)
      }
    }
    const project = resources.find(
      (r) => r.type === "neon:index/project:Project",
    )!
    assert.equal(project.inputs.pgVersion, 18)
    assert.equal(project.inputs.historyRetentionSeconds, 21600)
    assert.equal(project.inputs.branch, undefined)
    assert.equal(project.inputs.primaryCompute, undefined)
  },
)
