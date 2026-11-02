export function formatDuration(value: number | null) {
  if (value === null) {
    return "Not reported"
  }
  return value < 1000
    ? `${Math.round(value)} ms`
    : `${(value / 1000).toFixed(2)} s`
}

export function formatTimestamp(value: string) {
  return new Date(value).toISOString().replace("T", " ").slice(0, 19)
}
