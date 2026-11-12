import {
  RunReadInputSchema,
  RunReadResponseSchema,
  runReadEvidencePath,
  PeriodReadInputSchema,
  PeriodReadResponseSchema,
  matchesPeriodRead,
  type RunReadInput,
  type RunReadResponse,
  type PeriodReadInput,
  type PeriodReadResponse,
} from "@flowmarkdev/core"
import { createReadTransport } from "./transport.js"

export interface FlowmarkReadClient {
  readRun(
    input: RunReadInput,
    options?: { signal?: AbortSignal },
  ): Promise<RunReadResponse>
  readPeriod(
    input: PeriodReadInput,
    options?: { signal?: AbortSignal },
  ): Promise<PeriodReadResponse>
}

const matchesRunRead = (decoded: RunReadResponse, selection: RunReadInput) =>
  decoded.selection.projectId.toLowerCase() ===
    selection.projectId.toLowerCase() &&
  decoded.selection.runId.toLowerCase() === selection.runId.toLowerCase() &&
  decoded.summary.id.toLowerCase() === selection.runId.toLowerCase() &&
  decoded.selection.limit === (selection.limit ?? 50) &&
  decoded.selection.cursor === selection.cursor &&
  decoded.evidence.runPath === runReadEvidencePath(decoded.selection) &&
  decoded.page.limit === decoded.selection.limit &&
  decoded.page.events.length <= decoded.page.limit

export const createFlowmarkReadClient = (options: {
  apiBaseUrl: string
  readKey: string
}): FlowmarkReadClient => {
  const transport = createReadTransport(options)
  return {
    readRun: (input, options) =>
      transport.request(
        "run",
        input,
        RunReadInputSchema,
        RunReadResponseSchema,
        matchesRunRead,
        options,
      ),
    readPeriod: (input, options) =>
      transport.request(
        "period",
        input,
        PeriodReadInputSchema,
        PeriodReadResponseSchema,
        matchesPeriodRead,
        options,
      ),
  }
}
