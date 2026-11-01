import * as pulumi from "@pulumi/pulumi"
import * as vercel from "@pulumiverse/vercel"

// These settings keep their existing owner during project-container adoption.
// In particular, inline environments must never compete with binding resources,
// and Git/protection/build settings must not be rewritten by provider defaults.
const externallyManagedProjectProperties = [
  "autoAssignCustomDomains",
  "buildCommand",
  "buildMachineType",
  "customerSuccessCodeVisibility",
  "devCommand",
  "directoryListing",
  "enablePreviewFeedback",
  "enableProductionFeedback",
  "environments",
  "framework",
  "functionFailover",
  "gitComments",
  "gitForkProtection",
  "gitLfs",
  "gitProviderOptions",
  "gitRepository",
  "ignoreCommand",
  "installCommand",
  "oidcTokenConfig",
  "onDemandConcurrentBuilds",
  "optionsAllowlist",
  "outputDirectory",
  "passwordProtection",
  "previewComments",
  "previewDeploymentSuffix",
  "prioritiseProductionBuilds",
  "protectedSourcemaps",
  "publicSource",
  "resourceConfig",
  "serverlessFunctionRegion",
  "skewProtection",
  "trustedIps",
  "trustedSources",
  "vercelAuthentication",
] satisfies Array<keyof vercel.ProjectArgs>

export const importProductionVercelProjects = () => {
  const config = new pulumi.Config()
  if (!config.getBoolean("importVercelProjects")) {
    return []
  }

  const teamId = config.require("vercelTeamId", { pattern: /^team_/ })
  const projects = [
    { app: "api", root: "apps/server", configKey: "vercelApiProjectId" },
    {
      app: "dashboard",
      root: "apps/dashboard",
      configKey: "vercelDashboardProjectId",
    },
    { app: "web", root: "apps/web", configKey: "vercelWebProjectId" },
    { app: "docs", root: "apps/docs", configKey: "vercelDocsProjectId" },
  ].map((project) => ({
    ...project,
    id: config.require(project.configKey, { pattern: /^prj_/ }),
  }))
  if (new Set(projects.map(({ id }) => id)).size !== projects.length) {
    throw new pulumi.RunError(
      "Each Vercel application needs a distinct project ID",
    )
  }

  const providerOptions: pulumi.CustomResourceOptions = {
    protect: true,
    additionalSecretOutputs: ["apiToken"],
  }
  const provider = new vercel.Provider(
    "vercel-production",
    {
      team: teamId,
      apiToken: new pulumi.Config("vercel").getSecret("apiToken"),
    },
    providerOptions,
  )

  return projects.map(
    ({ app, root, id }) =>
      new vercel.Project(
        `vercel-${app}`,
        {
          name: `flowmark-${app}`,
          teamId,
          rootDirectory: root,
          nodeVersion: "22.x",
          automaticallyExposeSystemEnvironmentVariables: true,
          enableAffectedProjectsDeployments: true,
          // Feature previews are intentionally paused; Staging uses the
          // existing controlled CLI rollout, not automatic Git previews.
          previewDeploymentsDisabled: true,
          // All four live projects have no Passport configuration. Specify the
          // disabled value so provider defaults cannot enable this paid feature.
          passport: { enabled: false },
        },
        {
          provider,
          import: `${teamId}/${id}`,
          protect: true,
          ignoreChanges: externallyManagedProjectProperties,
        },
      ).id,
  )
}
