import * as neon from "@pulumi/neon"
import * as pulumi from "@pulumi/pulumi"

type Stage = "preview" | "staging" | "production"

export const importNeonBranchResources = (
  provider: neon.Provider,
  branches: readonly { stage: Stage; id: string; resource: neon.Branch }[],
) => {
  const config = new pulumi.Config()
  if (!config.getBoolean("importNeonBranchResources")) {
    return
  }
  const projectId = config.require("neonProjectId", { minLength: 1 })
  for (const { stage, id, resource } of branches) {
    const endpointId = config.require(`${stage}EndpointId`, { pattern: /^ep-/ })
    const databaseName = config.require(`${stage}DatabaseName`, {
      minLength: 1,
    })
    const ownerName = config.require(`${stage}DatabaseOwnerRole`, {
      minLength: 1,
    })
    const role = new neon.Role(
      `neon-${stage}-owner`,
      { projectId, branchId: resource.id, name: ownerName },
      {
        provider,
        import: `${projectId}/${id}/${ownerName}`,
        protect: true,
        additionalSecretOutputs: ["password"],
      },
    )
    new neon.Database(
      `neon-${stage}-database`,
      {
        projectId,
        branchId: resource.id,
        name: databaseName,
        ownerName: role.name,
      },
      { provider, import: `${projectId}/${id}/${databaseName}`, protect: true },
    )
    new neon.Endpoint(
      `neon-${stage}-compute`,
      {
        projectId,
        branchId: resource.id,
        type: "read_write",
        regionId: "aws-eu-central-1",
        autoscalingLimitMinCu: 0.25,
        autoscalingLimitMaxCu: 2,
        suspendTimeoutSeconds: 0,
        disabled: false,
        pgSettings: {},
      },
      {
        provider,
        import: `${projectId}/${endpointId}`,
        protect: true,
        ignoreChanges: ["name", "computeProvisioner"],
      },
    )
  }
}

export const importProductionNeon = () => {
  const config = new pulumi.Config()
  if (!config.getBoolean("importProductionNeon")) {
    return []
  }
  const projectId = config.require("neonProjectId", { minLength: 1 })
  const branchId = config.require("productionBranchId", { pattern: /^br-/ })
  const providerOptions: pulumi.CustomResourceOptions = {
    protect: true,
    additionalSecretOutputs: ["apiKey"],
  }
  const provider = new neon.Provider(
    "neon-production",
    { apiKey: new pulumi.Config("neon").getSecret("apiKey") },
    providerOptions,
  )
  const project = new neon.Project(
    "neon-project",
    {
      name: "flowmark",
      orgId: config.require("neonOrgId", { minLength: 1 }),
      regionId: "aws-eu-central-1",
      pgVersion: 18,
      historyRetentionSeconds: 21600,
      autoscalingLimitMinCu: 0.25,
      autoscalingLimitMaxCu: 2,
      suspendTimeoutSeconds: 0,
      storePassword: "yes",
    },
    {
      provider,
      import: projectId,
      protect: true,
      additionalSecretOutputs: [
        "databasePassword",
        "connectionUri",
        "connectionUriPooler",
      ],
      // Separate resources own the default branch and compute. Existing
      // security, maintenance and quota policies retain their current owner.
      ignoreChanges: [
        "branch",
        "primaryCompute",
        "defaultBranchProtected",
        "allowedIps",
        "allowedIpsProtectedBranchesOnly",
        "blockPublicConnections",
        "blockVpcConnections",
        "enableLogicalReplication",
        "hipaa",
        "maintenanceWindow",
        "quota",
      ],
    },
  )
  const branch = new neon.Branch(
    "neon-production",
    { projectId: project.id, name: "production" },
    {
      provider,
      import: `${projectId}/${branchId}`,
      protect: true,
      ignoreChanges: ["parentId", "parentLsn", "parentTimestamp", "protected"],
    },
  )
  importNeonBranchResources(provider, [
    { stage: "production", id: branchId, resource: branch },
  ])
  return [project.id, branch.id]
}
