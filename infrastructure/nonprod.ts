import * as neon from "@pulumi/neon"
import * as pulumi from "@pulumi/pulumi"
import { importNeonBranchResources } from "./neon-additional"

export const importNonprodBranches = () => {
  const config = new pulumi.Config()
  const projectId = config.require("neonProjectId", { minLength: 1 })
  const previewId = config.require("previewBranchId", { pattern: /^br-/ })
  const stagingId = config.require("stagingBranchId", { pattern: /^br-/ })

  if (previewId === stagingId) {
    throw new pulumi.RunError(
      "Preview and Staging must be different Neon branches",
    )
  }

  const providerOptions: pulumi.CustomResourceOptions = {
    protect: true,
    additionalSecretOutputs: ["apiKey"],
  }
  const provider = new neon.Provider(
    "neon-nonprod",
    { apiKey: new pulumi.Config("neon").getSecret("apiKey") },
    providerOptions,
  )

  // The provider does not model schema-only initialization or TTL. Import the
  // existing roots, preserving ancestry and provider-side protection settings.
  // Never remove `import`: it prevents a missing resource from becoming create.
  const branches = [
    { name: "preview", id: previewId },
    { name: "staging", id: stagingId },
  ].map(
    ({ name, id }) =>
      new neon.Branch(
        `neon-${name}`,
        { projectId, name },
        {
          provider,
          import: `${projectId}/${id}`,
          protect: true,
          ignoreChanges: [
            "parentId",
            "parentLsn",
            "parentTimestamp",
            "protected",
          ],
        },
      ),
  )

  importNeonBranchResources(
    provider,
    branches.map((resource, index) => ({
      stage: index === 0 ? "preview" : "staging",
      id: index === 0 ? previewId : stagingId,
      resource,
    })),
  )
  return branches.map((branch) => branch.id)
}
