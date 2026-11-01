import * as pulumi from "@pulumi/pulumi"
import * as vercel from "@pulumiverse/vercel"

interface Binding {
  readonly project: "api" | "dashboard" | "web"
  readonly stage: "preview" | "staging"
  readonly key: string
  readonly sensitive: boolean
  readonly value: pulumi.Input<string>
}

export const importNonprodVercelBindings = () => {
  const config = new pulumi.Config()
  if (!config.getBoolean("importVercelBindings")) {
    return []
  }

  const teamId = config.require("vercelTeamId", { pattern: /^team_/ })
  const projects = {
    api: config.require("vercelApiProjectId", { pattern: /^prj_/ }),
    dashboard: config.require("vercelDashboardProjectId", { pattern: /^prj_/ }),
    web: config.require("vercelWebProjectId", { pattern: /^prj_/ }),
  }
  const providerOptions: pulumi.CustomResourceOptions = {
    protect: true,
    additionalSecretOutputs: ["apiToken"],
  }
  const provider = new vercel.Provider(
    "vercel-nonprod",
    {
      team: teamId,
      apiToken: new pulumi.Config("vercel").getSecret("apiToken"),
    },
    providerOptions,
  )

  const bindingName = ({
    project,
    stage,
    key,
  }: Omit<Binding, "value" | "sensitive">) =>
    `${project}-${stage}-${key.toLowerCase().replaceAll("_", "-")}`

  const apiBindings = (["preview", "staging"] as const).flatMap((stage) =>
    [
      { key: "DATABASE_URL", secretConfig: `${stage}DatabaseUrl` },
      { key: "BETTER_AUTH_SECRET", secretConfig: `${stage}BetterAuthSecret` },
      { key: "BETTER_AUTH_URL" },
      { key: "FLOWMARK_DASHBOARD_ORIGIN" },
      { key: "FLOWMARK_DATABASE_BRANCH" },
    ].map(({ key, secretConfig }): Binding => {
      const name = bindingName({ project: "api", stage, key })
      return {
        project: "api",
        stage,
        key,
        sensitive: secretConfig !== undefined,
        value: secretConfig
          ? config.requireSecret(secretConfig)
          : config.require(`${name}-value`, { minLength: 1 }),
      }
    }),
  )

  const bindings: readonly Binding[] = [
    ...apiBindings,
    {
      project: "dashboard",
      stage: "preview",
      key: "FLOWMARK_VERCEL_PROTECTION_BYPASS",
      sensitive: true,
      value: config.requireSecret("previewProtectionBypass"),
    },
    ...(
      [
        { project: "dashboard", key: "FLOWMARK_API_URL" },
        { project: "web", key: "NEXT_PUBLIC_FLOWMARK_APP_URL" },
      ] as const
    ).map(({ project, key }): Binding => ({
      project,
      stage: "staging",
      key,
      sensitive: false,
      value: config.require(
        `${bindingName({ project, stage: "staging", key })}-value`,
        { minLength: 1 },
      ),
    })),
  ]

  return bindings.map((binding) => {
    const name = bindingName(binding)
    const projectId = projects[binding.project]
    const envId = config.require(`${name}-id`, { minLength: 1 })
    const importId = `${teamId}/${projectId}/${envId}`
    return new vercel.ProjectEnvironmentVariable(
      name,
      {
        projectId,
        teamId,
        key: binding.key,
        targets: ["preview"],
        gitBranch: binding.stage === "staging" ? "staging" : undefined,
        sensitive: binding.sensitive,
        visibility: binding.sensitive ? "secret" : "config",
        ...(binding.sensitive
          ? { valueWo: binding.value }
          : { value: binding.value }),
      },
      {
        provider,
        import: binding.sensitive ? `write-only:${importId}` : importId,
        protect: true,
        additionalSecretOutputs: ["value", "valueWo"],
        // A write-only import preserves sensitive values without reading or
        // rewriting them. A later value update requires an explicit version bump.
      },
    ).id
  })
}
