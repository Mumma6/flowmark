import { Result } from "effect"
import { FlowmarkReadError } from "./error.js"

export const readEndpoint = (base: string) =>
  Result.try({
    try: () => {
      const url = new URL(base)
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
        url.hostname,
      )
      if (
        (url.protocol !== "https:" &&
          !(url.protocol === "http:" && loopback)) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new Error("Invalid API URL")
      }
      url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/read/`
      return url.toString()
    },
    catch: () => new FlowmarkReadError("INVALID_REQUEST"),
  })
