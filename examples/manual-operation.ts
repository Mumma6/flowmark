import type { WorkflowOperation } from "@flowmarkdev/node"
import { flowmark } from "./flowmark"

declare function transcode(assetId: string): Promise<void>

/**
 * The handle form does not wrap the work. Close it with `done()` or
 * `fail()` yourself. `operationId` identifies this operation's events.
 * An operation failure does not fail the run until `flow.fail()` says so.
 */
export async function transcodeAsset(assetId: string): Promise<string> {
  const flow = flowmark.workflow("media.encode", {
    properties: { assetId },
  })
  const encode: WorkflowOperation = flow.operation("transcode", {
    properties: { profile: "hls" },
  })

  try {
    await transcode(assetId)
    encode.done()
    flow.done({ outcome: "ready", result: { assetId } })
    return encode.operationId
  } catch (cause) {
    encode.fail({
      code: "TRANSCODE_FAILED",
      message: "Encoder exited before the asset was ready",
      retryable: true,
    })
    flow.fail({
      code: "TRANSCODE_FAILED",
      message: "Encoder exited before the asset was ready",
      retryable: true,
      outcome: "unusable",
      result: { assetId },
    })
    throw cause
  }
}
