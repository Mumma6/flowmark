import * as pulumi from "@pulumi/pulumi"
import { importNonprodBranches } from "./nonprod"
import { importNonprodVercelBindings } from "./vercel-nonprod"
import { importProductionVercelProjects } from "./vercel-production"

// Register before declaring or importing resources. Protection also prevents
// replacements that would delete an adopted resource.
pulumi.runtime.registerResourceTransform(({ props, opts }) => ({
  props,
  opts: { ...opts, protect: true },
}))

export const stackName = pulumi.getStack()

if (stackName !== "nonprod" && stackName !== "production") {
  throw new pulumi.RunError("Use the nonprod or production stack")
}

export const nonprodBranchIds =
  stackName === "nonprod" ? importNonprodBranches() : []

export const nonprodVercelBindingIds =
  stackName === "nonprod" ? importNonprodVercelBindings() : []

export const productionProjectIds =
  stackName === "production" ? importProductionVercelProjects() : []
