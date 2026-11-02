import * as pulumi from "@pulumi/pulumi"
import * as vercel from "@pulumiverse/vercel"

export const importProductionVercelBindings = (provider: vercel.Provider) => {
  const config = new pulumi.Config()
  if (!config.getBoolean("importProductionVercelBindings")) {
    return
  }
  const includeAuth = config.getBoolean("importProductionAuthBinding") ?? false
  const includeDatabase =
    config.getBoolean("importProductionDatabaseBinding") ?? false
  // Write-only import preserves Vercel's value; it cannot activate a prepared
  // replacement. Block apply until that separately approved step is complete.
  if (
    includeAuth &&
    config.getBoolean("productionAuthSecretPending") &&
    !pulumi.runtime.isDryRun()
  ) {
    throw new pulumi.RunError(
      "Activate the approved Production auth secret before importing its binding",
    )
  }
  const teamId = config.require("vercelTeamId", { pattern: /^team_/ })
  const bindings = [
    { app: "Api", key: "DATABASE_URL", secretConfig: "productionDatabaseUrl" },
    {
      app: "Api",
      key: "BETTER_AUTH_SECRET",
      secretConfig: "productionBetterAuthSecret",
    },
    { app: "Api", key: "BETTER_AUTH_URL" },
    { app: "Api", key: "FLOWMARK_DASHBOARD_ORIGIN" },
    { app: "Dashboard", key: "FLOWMARK_API_URL" },
    { app: "Dashboard", key: "NEXT_PUBLIC_FLOWMARK_DOCS_URL", shared: true },
    { app: "Web", key: "NEXT_PUBLIC_FLOWMARK_APP_URL", shared: true },
    { app: "Web", key: "NEXT_PUBLIC_FLOWMARK_DOCS_URL", shared: true },
  ] as const
  for (const binding of bindings) {
    if (binding.key === "BETTER_AUTH_SECRET" && !includeAuth) {
      continue
    }
    if (binding.key === "DATABASE_URL" && !includeDatabase) {
      continue
    }
    const name = `${binding.app.toLowerCase()}-production-${binding.key.toLowerCase().replaceAll("_", "-")}`
    const projectId = config.require(`vercel${binding.app}ProjectId`, {
      pattern: /^prj_/,
    })
    const envId = config.require(`${name}-id`, { minLength: 1 })
    const sensitive = "secretConfig" in binding
    const value = sensitive
      ? config.requireSecret(binding.secretConfig)
      : config.require(`${name}-value`, { minLength: 1 })
    const id = `${teamId}/${projectId}/${envId}`
    new vercel.ProjectEnvironmentVariable(
      name,
      {
        projectId,
        teamId,
        key: binding.key,
        targets:
          "shared" in binding ? ["production", "preview"] : ["production"],
        sensitive,
        visibility: sensitive ? "secret" : "config",
        ...(sensitive ? { valueWo: value } : { value }),
      },
      {
        provider,
        import: sensitive ? `write-only:${id}` : id,
        protect: true,
        additionalSecretOutputs: ["value", "valueWo"],
      },
    )
  }
}
