import * as pulumi from "@pulumi/pulumi"
import { importNonprodBranches } from "./nonprod"
import { importNonprodVercelBindings } from "./vercel-nonprod"
import { importProductionVercelProjects } from "./vercel-production"
import { importProductionNeon } from "./neon-additional"
import { manageEmailBindings } from "./vercel-email"
import { manageResendDomain } from "./resend-domain"
import { manageProductionEmailKey } from "./resend-email-key"

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

export const productionNeonIds =
  stackName === "production" ? importProductionNeon() : []

const transactionalEmail = manageResendDomain(stackName)
const productionEmailKey = manageProductionEmailKey(
  stackName,
  transactionalEmail,
)
export const emailBindingIds = manageEmailBindings(
  stackName,
  productionEmailKey?.token,
)
export const productionEmailKeyId = productionEmailKey?.id
export const resendDomainId = transactionalEmail?.domain.id
export const resendDomainStatus = transactionalEmail?.domain.status
export const resendDnsRecordIds = transactionalEmail?.dns.map(
  (record) => record.id,
)
