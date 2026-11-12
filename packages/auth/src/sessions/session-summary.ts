import { Match } from "effect"

/** Approximate display only: user-agent strings are untrusted, never identity. */
export const sessionDeviceLabel = (userAgent: string | null | undefined) => {
  const value = (userAgent ?? "").slice(0, 512)
  const browser = Match.value(value).pipe(
    Match.when(
      (text) => /Edg\//.test(text),
      () => "Edge",
    ),
    Match.when(
      (text) => /Firefox\//.test(text),
      () => "Firefox",
    ),
    Match.when(
      (text) => /Chrome\//.test(text),
      () => "Chrome",
    ),
    Match.when(
      (text) => /Safari\//.test(text),
      () => "Safari",
    ),
    Match.orElse(() => "Browser"),
  )
  const platform = Match.value(value).pipe(
    Match.when(
      (text) => /Android/.test(text),
      () => "Android",
    ),
    Match.when(
      (text) => /iPhone|iPad/.test(text),
      () => "iOS",
    ),
    Match.when(
      (text) => /Windows/.test(text),
      () => "Windows",
    ),
    Match.when(
      (text) => /Macintosh|Mac OS/.test(text),
      () => "macOS",
    ),
    Match.when(
      (text) => /Linux/.test(text),
      () => "Linux",
    ),
    Match.orElse(() => null),
  )
  return platform ? `${browser} on ${platform}` : browser
}
