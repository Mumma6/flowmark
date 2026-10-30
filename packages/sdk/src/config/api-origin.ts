import { Schema } from "effect"

export const ApiOriginSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => {
      try {
        const url = new URL(value)
        return (
          url.protocol === "https:" ||
          (url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
        )
      } catch {
        return false
      }
    }),
  ),
)
