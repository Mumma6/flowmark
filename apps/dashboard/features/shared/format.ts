import { Match } from "effect"

export function formatDuration(value: number | null) {
  return Match.value(value).pipe(
    Match.when(null, () => "Not reported"),
    Match.when(
      (duration) => duration < 1000,
      (duration) => `${Math.round(duration)} ms`,
    ),
    Match.orElse((duration) => `${(duration / 1000).toFixed(2)} s`),
  )
}

export function formatTimestamp(value: string) {
  return new Date(value).toISOString().replace("T", " ").slice(0, 19)
}
