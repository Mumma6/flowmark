import assert from "node:assert/strict"
import test from "node:test"
import * as pulumi from "@pulumi/pulumi"
import type { MockResourceArgs } from "@pulumi/pulumi/runtime"
import { manageEmailBindings } from "../vercel-email"

const registered: MockResourceArgs[] = []
pulumi.runtime.setMocks(
  {
    newResource: (args) => {
      registered.push(args)
      return { id: args.name, state: args.inputs }
    },
    call: ({ inputs }) => inputs,
  },
  "flowmark-infrastructure",
  "nonprod",
  false,
)
const configure = (values: Record<string, string>) =>
  pulumi.runtime.setAllConfig(
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        `flowmark-infrastructure:${key}`,
        value,
      ]),
    ),
  )
const waitFor = (outputs: pulumi.Output<string>[]) =>
  new Promise<void>((resolve) => pulumi.all(outputs).apply(() => resolve()))

test("dummy config alone declares no bindings in either stack", () => {
  configure({ stagingResendApiKey: "re_dummy" })
  assert.deepEqual(manageEmailBindings("nonprod"), [])
  assert.deepEqual(manageEmailBindings("production"), [])
})

test("enabled mail requires a positive integer secret version and sender configuration", () => {
  configure({
    stagingEmailBindingsEnabled: "true",
    vercelTeamId: "team_fixture",
    vercelApiProjectId: "prj_api",
    stagingResendApiKeyVersion: "0",
  })
  assert.throws(() => manageEmailBindings("nonprod"))
})

test("each environment has isolated API-only scopes and a write-only sensitive key", async () => {
  const values = {
    vercelTeamId: "team_fixture",
    vercelApiProjectId: "prj_api",
    ...Object.fromEntries(
      ["staging", "preview", "production"].flatMap((stage) => [
        [`${stage}EmailBindingsEnabled`, "true"],
        [`${stage}ResendApiKey`, `re_fixture_${stage}`],
        [`${stage}ResendApiKeyVersion`, "1"],
        [`${stage}EmailFrom`, `accounts@${stage}.example.com`],
        [`${stage}EmailReplyTo`, `help@${stage}.example.com`],
      ]),
    ),
  }
  configure(values)
  await waitFor(manageEmailBindings("nonprod"))
  await waitFor(
    manageEmailBindings("production", pulumi.secret("re_fixture_production")),
  )
  const bindings = registered.filter((resource) =>
    resource.type.includes("projectEnvironmentVariable"),
  )
  assert.equal(bindings.length, 12)
  for (const binding of bindings) {
    assert.equal(binding.inputs.projectId, "prj_api")
    assert.equal(binding.inputs.teamId, "team_fixture")
    const stage = binding.name.split("-")[1]
    assert.deepEqual(binding.inputs.targets, [
      stage === "production" ? "production" : "preview",
    ])
    assert.equal(
      binding.inputs.gitBranch,
      stage === "staging" ? "staging" : undefined,
    )
    if (binding.inputs.key === "RESEND_API_KEY") {
      assert.equal(binding.inputs.value, undefined)
      assert.equal(binding.inputs.sensitive, true)
      assert.equal(binding.inputs.visibility, "secret")
      assert.equal(binding.inputs.valueWoVersion, 1)
      assert.ok(binding.inputs.valueWo)
    } else {
      assert.equal(binding.inputs.sensitive, false)
      assert.ok(binding.inputs.value)
      if (binding.inputs.key === "FLOWMARK_EMAIL_ENVIRONMENT") {
        assert.equal(binding.inputs.value.value ?? binding.inputs.value, stage)
      }
    }
  }
})
