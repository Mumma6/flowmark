import * as pulumi from "@pulumi/pulumi"
import * as vercel from "@pulumiverse/vercel"

export const importVercelDomains = (provider: vercel.Provider) => {
  const config = new pulumi.Config()
  if (!config.getBoolean("importVercelDomains")) {
    return
  }
  const teamId = config.require("vercelTeamId", { pattern: /^team_/ })
  const domains = [
    { app: "Api", domain: "api.flowmark.dev" },
    { app: "Api", domain: "api.staging.flowmark.dev", gitBranch: "staging" },
    { app: "Dashboard", domain: "app.flowmark.dev" },
    {
      app: "Dashboard",
      domain: "app.staging.flowmark.dev",
      gitBranch: "staging",
    },
    { app: "Web", domain: "flowmark.dev" },
    { app: "Web", domain: "www.flowmark.dev", redirect: "flowmark.dev" },
    { app: "Docs", domain: "docs.flowmark.dev" },
  ] as const
  for (const domain of domains) {
    const projectId = config.require(`vercel${domain.app}ProjectId`, {
      pattern: /^prj_/,
    })
    new vercel.ProjectDomain(
      `domain-${domain.domain.replaceAll(".", "-")}`,
      {
        projectId,
        teamId,
        domain: domain.domain,
        gitBranch: "gitBranch" in domain ? domain.gitBranch : undefined,
        redirect: "redirect" in domain ? domain.redirect : undefined,
        redirectStatusCode: "redirect" in domain ? 308 : undefined,
      },
      {
        provider,
        import: `${teamId}/${projectId}/${domain.domain}`,
        protect: true,
      },
    )
  }
}
