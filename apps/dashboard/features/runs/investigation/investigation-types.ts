import type { AppRouter } from "@flowmark/server/trpc"
import type { inferRouterOutputs } from "@trpc/server"
import type { RunEvent } from "../../platform/api-types"
import type { buildInvestigation } from "./investigation-model"
import type { useRunInvestigation } from "./use-run-investigation"
type RunComparison = inferRouterOutputs<AppRouter>["run"]["compare"]

export type RunInvestigationProps = {
  runId: string
  events: readonly RunEvent[]
  comparison?: RunComparison
  comparisonLoading?: boolean
  comparisonError?: string
  contextual?: boolean
}

export type InvestigationSectionProps = Omit<
  RunInvestigationProps,
  "contextual" | "comparisonLoading"
> & {
  readonly contextual: boolean
  readonly comparisonLoading: boolean
} & Extract<
    ReturnType<typeof buildInvestigation>,
    { readonly _tag: "Some" }
  >["value"] &
  ReturnType<typeof useRunInvestigation>
