import assert from "node:assert/strict"
import test from "node:test"
import * as pulumi from "@pulumi/pulumi"
import * as vercel from "@pulumiverse/vercel"
import { importProductionVercelBindings } from "../vercel-production-bindings"

pulumi.runtime.setMocks(
  {
    newResource: ({ name, inputs }) => ({ id: name, state: inputs }),
    call: ({ inputs }) => inputs,
  },
  "flowmark-infrastructure",
  "production",
  false,
)

test("an inactive replacement secret cannot be adopted during an actual update", () => {
  pulumi.runtime.setAllConfig({
    "flowmark-infrastructure:importProductionVercelBindings": "true",
    "flowmark-infrastructure:importProductionAuthBinding": "true",
    "flowmark-infrastructure:productionAuthSecretPending": "true",
  })
  const provider = new vercel.Provider("fixture", {})
  assert.throws(
    () => importProductionVercelBindings(provider),
    /Activate the approved Production auth secret/,
  )
})
