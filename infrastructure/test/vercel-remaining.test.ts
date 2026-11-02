import assert from "node:assert/strict"
import test from "node:test"
import * as pulumi from "@pulumi/pulumi"
import type { MockResourceArgs } from "@pulumi/pulumi/runtime"
import { importProductionVercelProjects } from "../vercel-production"

const registered: MockResourceArgs[] = []
let resolveRegistrations = () => {}
const allRegistered = new Promise<void>((resolve) => {
  resolveRegistrations = resolve
})
pulumi.runtime.setMocks(
  {
    newResource: (args) => {
      registered.push(args)
      if (registered.length === 20) {
        resolveRegistrations()
      }
      return { id: args.id ?? args.name, state: args.inputs }
    },
    call: ({ inputs }) => inputs,
  },
  "flowmark-infrastructure",
  "production",
  true,
)

test(
  "remaining domains and bindings preserve branch scopes, redirects and sensitive write-only imports",
  { timeout: 5000 },
  async () => {
    const config: Record<string, string> = {
      importVercelProjects: "true",
      importVercelDomains: "true",
      importProductionVercelBindings: "true",
      importProductionAuthBinding: "true",
      importProductionDatabaseBinding: "true",
      vercelTeamId: "team_fixture",
      productionDatabaseUrl: "fixture-database-secret",
      productionBetterAuthSecret: "fixture-auth-secret",
    }
    for (const app of ["Api", "Dashboard", "Web", "Docs"]) {
      config[`vercel${app}ProjectId`] = `prj_${app.toLowerCase()}`
    }
    const bindingKeys = {
      api: [
        "DATABASE_URL",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
        "FLOWMARK_DASHBOARD_ORIGIN",
      ],
      dashboard: ["FLOWMARK_API_URL", "NEXT_PUBLIC_FLOWMARK_DOCS_URL"],
      web: ["NEXT_PUBLIC_FLOWMARK_APP_URL", "NEXT_PUBLIC_FLOWMARK_DOCS_URL"],
    }
    for (const [app, keys] of Object.entries(bindingKeys)) {
      for (const key of keys) {
        const name = `${app}-production-${key.toLowerCase().replaceAll("_", "-")}`
        config[`${name}-id`] = `env_${app}_${key}`
        config[`${name}-value`] = "https://fixture.example"
      }
    }
    pulumi.runtime.setAllConfig(
      Object.fromEntries(
        Object.entries(config).map(([k, v]) => [
          `flowmark-infrastructure:${k}`,
          v,
        ]),
      ),
    )
    const ids = importProductionVercelProjects()
    await new Promise<void>((resolve) => pulumi.all(ids).apply(() => resolve()))
    await allRegistered
    assert.equal(
      registered.filter((r) => r.type === "pulumi:providers:vercel").length,
      1,
    )
    const domains = registered.filter(
      (r) => r.type === "vercel:index/projectDomain:ProjectDomain",
    )
    assert.equal(domains.length, 7)
    assert.ok(domains.every((r) => !r.inputs.domain.endsWith("vercel.app")))
    for (const d of domains) {
      assert.equal(
        d.id,
        `team_fixture/${d.inputs.projectId}/${d.inputs.domain}`,
      )
      assert.equal(
        d.inputs.gitBranch,
        d.inputs.domain.includes(".staging.") ? "staging" : undefined,
      )
      assert.equal(
        d.inputs.redirect,
        d.inputs.domain === "www.flowmark.dev" ? "flowmark.dev" : undefined,
      )
      assert.equal(
        d.inputs.redirectStatusCode,
        d.inputs.domain === "www.flowmark.dev" ? 308 : undefined,
      )
    }
    const bindings = registered.filter(
      (r) =>
        r.type ===
        "vercel:index/projectEnvironmentVariable:ProjectEnvironmentVariable",
    )
    assert.equal(bindings.length, 8)
    for (const b of bindings) {
      const shared = b.inputs.key.startsWith("NEXT_PUBLIC_")
      assert.deepEqual(
        b.inputs.targets,
        shared ? ["production", "preview"] : ["production"],
      )
      assert.equal(b.inputs.gitBranch, undefined)
      const secret = ["DATABASE_URL", "BETTER_AUTH_SECRET"].includes(
        b.inputs.key,
      )
      assert.equal(b.inputs.sensitive, secret)
      assert.equal(b.id?.startsWith("write-only:"), secret)
      assert.equal(b.inputs.valueWoVersion, undefined)
      if (secret) {
        assert.equal(b.inputs.value, undefined)
        assert.ok(b.inputs.valueWo)
      } else {
        const value =
          typeof b.inputs.value === "object"
            ? b.inputs.value.value
            : b.inputs.value
        assert.equal(value, "https://fixture.example")
        assert.equal(b.inputs.valueWo, undefined)
      }
    }
  },
)
