import * as pulumi from "@pulumi/pulumi"
import * as vercel from "@pulumiverse/vercel"

// Gates stay disabled until sender/domain, environment and exact plan are
// approved. Merely storing a dummy key never enables hosted email.
export const manageEmailBindings = (
  stack: "nonprod" | "production",
  productionApiKey?: pulumi.Input<string>,
) => {
  const config = new pulumi.Config()
  const stages =
    stack === "production" ? ["production"] : ["preview", "staging"]
  const enabled = stages.filter((stage) =>
    config.getBoolean(`${stage}EmailBindingsEnabled`),
  )
  if (enabled.length === 0) {
    return []
  }
  if (stack === "production" && productionApiKey === undefined) {
    throw new pulumi.RunError(
      "Production mail requires its managed, domain-scoped sending key",
    )
  }
  const teamId = config.require("vercelTeamId", { pattern: /^team_/ })
  const projectId = config.require("vercelApiProjectId", { pattern: /^prj_/ })
  const providerOptions: pulumi.CustomResourceOptions = {
    additionalSecretOutputs: ["apiToken"],
  }
  const provider = new vercel.Provider(
    `vercel-${stack}-email`,
    {
      team: teamId,
      apiToken: new pulumi.Config("vercel").getSecret("apiToken"),
    },
    providerOptions,
  )

  return enabled.flatMap((stage) => {
    const version = config.requireNumber(`${stage}ResendApiKeyVersion`)
    if (!Number.isInteger(version) || version < 1) {
      throw new pulumi.RunError(
        `${stage}ResendApiKeyVersion must be a positive integer`,
      )
    }
    const values = [
      {
        key: "RESEND_API_KEY",
        value:
          stage === "production"
            ? productionApiKey!
            : config.requireSecret(`${stage}ResendApiKey`, {
                pattern: /^re_[A-Za-z0-9_-]+$/,
              }),
        sensitive: true,
      },
      {
        key: "FLOWMARK_EMAIL_ENVIRONMENT",
        value: stage,
        sensitive: false,
      },
      {
        key: "FLOWMARK_EMAIL_FROM",
        value: config.require(`${stage}EmailFrom`, {
          pattern: /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/,
        }),
        sensitive: false,
      },
      {
        key: "FLOWMARK_EMAIL_REPLY_TO",
        value: config.require(`${stage}EmailReplyTo`, {
          pattern: /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/,
        }),
        sensitive: false,
      },
    ]
    return values.map(
      ({ key, value, sensitive }) =>
        new vercel.ProjectEnvironmentVariable(
          `api-${stage}-${key.toLowerCase().replaceAll("_", "-")}`,
          {
            projectId,
            teamId,
            key,
            targets: [stage === "production" ? "production" : "preview"],
            gitBranch: stage === "staging" ? "staging" : undefined,
            sensitive,
            visibility: sensitive ? "secret" : "config",
            ...(sensitive
              ? { valueWo: value, valueWoVersion: version }
              : { value }),
          },
          {
            provider,
            protect: true,
            additionalSecretOutputs: ["value", "valueWo"],
          },
        ).id,
    )
  })
}
