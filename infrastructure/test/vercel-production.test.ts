import assert from "node:assert/strict"
import test from "node:test"
import * as pulumi from "@pulumi/pulumi"
import type { MockResourceArgs } from "@pulumi/pulumi/runtime"
import { importProductionVercelProjects } from "../vercel-production"

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
  "production",
  true,
)

const configure = (config: Record<string, string>) =>
  pulumi.runtime.setAllConfig(
    Object.fromEntries(
      Object.entries(config).map(([key, value]) => [
        `flowmark-infrastructure:${key}`,
        value,
      ]),
    ),
  )

test("production project adoption requires explicit opt-in", () => {
  configure({})
  assert.deepEqual(importProductionVercelProjects(), [])
})

test("duplicate project IDs fail before resource registration", () => {
  configure({
    importVercelProjects: "true",
    vercelTeamId: "team_fixture",
    vercelApiProjectId: "prj_same",
    vercelDashboardProjectId: "prj_same",
    vercelWebProjectId: "prj_same",
    vercelDocsProjectId: "prj_same",
  })
  assert.throws(importProductionVercelProjects, /distinct project ID/)
  assert.equal(registered.length, 0)
})

test("only existing app projects are imported and feature previews stay paused", async () => {
  configure({
    importVercelProjects: "true",
    vercelTeamId: "team_fixture",
    vercelApiProjectId: "prj_api",
    vercelDashboardProjectId: "prj_dashboard",
    vercelWebProjectId: "prj_web",
    vercelDocsProjectId: "prj_docs",
  })
  const ids = importProductionVercelProjects()
  await new Promise<void>((resolve) => {
    pulumi.all(ids).apply(() => resolve())
  })

  const projects = registered.filter(
    ({ type }) => type === "vercel:index/project:Project",
  )
  assert.equal(projects.length, 4)
  for (const project of projects) {
    const app = project.name.replace("vercel-", "")
    assert.ok(["api", "dashboard", "web", "docs"].includes(app))
    assert.equal(project.id, `team_fixture/prj_${app}`)
    assert.equal(project.inputs.name, `flowmark-${app}`)
    assert.equal(
      project.inputs.rootDirectory,
      `apps/${app === "api" ? "server" : app}`,
    )
    assert.equal(project.inputs.nodeVersion, "22.x")
    assert.equal(project.inputs.teamId, "team_fixture")
    assert.equal(project.inputs.previewDeploymentsDisabled, true)
    assert.equal(
      project.inputs.automaticallyExposeSystemEnvironmentVariables,
      true,
    )
    assert.equal(project.inputs.enableAffectedProjectsDeployments, true)
    assert.deepEqual(project.inputs.passport, { enabled: false })
    for (const field of [
      "environments",
      "gitRepository",
      "gitProviderOptions",
      "buildCommand",
      "installCommand",
      "ignoreCommand",
      "resourceConfig",
    ]) {
      assert.equal(project.inputs[field], undefined)
    }
  }
  assert.ok(
    registered.every(({ type }) =>
      ["pulumi:providers:vercel", "vercel:index/project:Project"].includes(
        type,
      ),
    ),
  )
})
