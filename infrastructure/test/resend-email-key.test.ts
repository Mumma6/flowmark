import assert from "node:assert/strict"
import test from "node:test"
import * as pulumi from "@pulumi/pulumi"
import * as resend from "@pulumi/resend"
import type { MockResourceArgs } from "@pulumi/pulumi/runtime"
import { manageProductionEmailKey } from "../resend-email-key"

const registered: MockResourceArgs[] = []
pulumi.runtime.setMocks(
  {
    newResource: (args) => {
      registered.push(args)
      return {
        id: args.name,
        state: {
          ...args.inputs,
          token: pulumi.secret("re_synthetic_production_sending"),
        },
      }
    },
    call: ({ inputs }) => inputs,
  },
  "flowmark-infrastructure",
  "production",
  false,
)

test("Production key is opt-in, owned only by production and requires the managed domain", () => {
  pulumi.runtime.setAllConfig({})
  assert.equal(manageProductionEmailKey("production"), undefined)
  pulumi.runtime.setAllConfig({
    "flowmark-infrastructure:productionEmailBindingsEnabled": "true",
  })
  assert.equal(manageProductionEmailKey("nonprod"), undefined)
  assert.throws(
    () => manageProductionEmailKey("production"),
    /owned sending domain/,
  )
})

test("Production receives a separate secret sending-only key restricted to the owned domain", async () => {
  pulumi.runtime.setAllConfig({
    "flowmark-infrastructure:productionEmailBindingsEnabled": "true",
  })
  const provider = new resend.Provider("fixture-management", {
    apiKey: pulumi.secret("re_admin_fixture"),
  })
  const domain = new resend.Domain(
    "fixture-domain",
    { name: "flowmark.dev" },
    { provider },
  )
  const key = manageProductionEmailKey("production", { provider, domain })!
  await new Promise<void>((resolve) => key.id.apply(() => resolve()))
  const resource = registered.find(
    (entry) => entry.type === "resend:index/apiKey:ApiKey",
  )!
  assert.equal(resource.inputs.name, "Flowmark Production")
  assert.equal(resource.inputs.permission, "sending_access")
  assert.equal(resource.inputs.domainId, "fixture-domain")
  assert.equal(await pulumi.isSecret(key.token), true)
})
