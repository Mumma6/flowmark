import { createFlowmark, type FlowmarkConfig } from "@flowmarkdev/node"

export type FlowmarkBinding = "configured" | "unconfigured"

/** Visible when the process has no complete deployment binding. */
export function flowmarkBinding(
  env: NodeJS.ProcessEnv = process.env,
): FlowmarkBinding {
  const configured = [
    env.FLOWMARK_API_KEY,
    env.FLOWMARK_BINDING_ID,
    env.FLOWMARK_DEPLOYMENT_ID,
    env.FLOWMARK_ARTIFACT_DIGEST,
    env.FLOWMARK_PROBE_ID,
  ].every((value) => typeof value === "string" && value.length > 0)
  return configured ? "configured" : "unconfigured"
}

export function createSampleFlowmark(
  env: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof createFlowmark> | undefined {
  if (flowmarkBinding(env) === "unconfigured") {
    return undefined
  }
  const deployment: FlowmarkConfig["deployment"] = {
    bindingId: env.FLOWMARK_BINDING_ID,
    deploymentId: env.FLOWMARK_DEPLOYMENT_ID,
    artifactDigest: env.FLOWMARK_ARTIFACT_DIGEST,
    probeId: env.FLOWMARK_PROBE_ID,
  }
  return createFlowmark({
    apiKey: env.FLOWMARK_API_KEY,
    apiUrl: env.FLOWMARK_API_URL,
    deployment,
  })
}
