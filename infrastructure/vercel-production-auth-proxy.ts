import * as pulumi from "@pulumi/pulumi"
import * as vercel from "@pulumiverse/vercel"

export const manageProductionAuthProxyBindings = (
  provider: vercel.Provider,
) => {
  const config = new pulumi.Config()
  if (!config.getBoolean("manageProductionAuthProxyBindings")) {
    return []
  }

  const version = config.requireNumber("productionAuthProxySecretVersion")
  if (!Number.isInteger(version) || version < 1) {
    throw new pulumi.RunError(
      "productionAuthProxySecretVersion must be a positive integer",
    )
  }
  const value = config.requireSecret("productionAuthProxySecret", {
    minLength: 32,
  })
  const teamId = config.require("vercelTeamId", { pattern: /^team_/ })

  // These are new bindings, not imports. Keep one shared Production-only input
  // and version so both sides of the signed hop change in the same plan.
  return (["Api", "Dashboard"] as const).map((app) => {
    const projectId = config.require(`vercel${app}ProjectId`, {
      pattern: /^prj_/,
    })
    return new vercel.ProjectEnvironmentVariable(
      `${app.toLowerCase()}-production-flowmark-auth-proxy-secret`,
      {
        projectId,
        teamId,
        key: "FLOWMARK_AUTH_PROXY_SECRET",
        targets: ["production"],
        sensitive: true,
        visibility: "secret",
        valueWo: value,
        valueWoVersion: version,
      },
      {
        provider,
        protect: true,
        additionalSecretOutputs: ["value", "valueWo"],
      },
    ).id
  })
}
