import { Context } from "effect"
import type { ProjectReader } from "./project-reader.js"

/** Request-local identity carried to persistence; never a cached authorization. */
export const CurrentProjectReader = Context.Reference<
  ProjectReader | undefined
>("@flowmark/api/CurrentProjectReader", { defaultValue: () => undefined })
