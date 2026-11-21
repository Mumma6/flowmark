import { Match } from "effect"

export function candidateSupport(
  sourceWorkflow: string | undefined,
  recordedWorkflow: string | undefined,
) {
  return Match.value({
    source: Boolean(sourceWorkflow),
    recorded: Boolean(recordedWorkflow),
    agrees: sourceWorkflow === recordedWorkflow,
  }).pipe(
    Match.when(
      { source: true, recorded: true, agrees: true },
      () => "Name agreement" as const,
    ),
    Match.when({ source: true, recorded: true }, () => "Names differ" as const),
    Match.when({ source: true }, () => "Source only" as const),
    Match.when({ recorded: true }, () => "Recorded only" as const),
    Match.orElse(() => "Unverified" as const),
  )
}
