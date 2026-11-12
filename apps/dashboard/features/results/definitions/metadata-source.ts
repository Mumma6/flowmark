import { Option, Record as EffectRecord } from "effect"

export const searchFieldSource = (
  sources: Readonly<Record<string, string>> | undefined,
  key: string,
) => EffectRecord.get(sources ?? {}, key)

export const searchFieldOwnerLabel = (
  sources: Readonly<Record<string, string>> | undefined,
  key: string,
) =>
  searchFieldSource(sources, key).pipe(
    Option.match({
      onNone: () => "Studio",
      onSome: (source) => `Code: ${source}`,
    }),
  )
