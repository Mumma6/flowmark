import * as pulumi from "@pulumi/pulumi"
import * as resend from "@pulumi/resend"

export const manageProductionEmailKey = (
  stack: "nonprod" | "production",
  shared?: {
    readonly domain: resend.Domain
    readonly provider: resend.Provider
  },
) => {
  if (
    stack !== "production" ||
    !new pulumi.Config().getBoolean("productionEmailBindingsEnabled")
  ) {
    return undefined
  }
  if (!shared) {
    throw new pulumi.RunError(
      "Production email requires the Pulumi-owned sending domain",
    )
  }
  return new resend.ApiKey(
    "api-production-resend-sending-key",
    {
      name: "Flowmark Production",
      permission: "sending_access",
      domainId: shared.domain.id,
    },
    {
      provider: shared.provider,
      protect: true,
      additionalSecretOutputs: ["token"],
    },
  )
}
