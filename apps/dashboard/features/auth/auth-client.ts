import { createAuthClient } from "better-auth/react"
import { publicConfig } from "../platform/config-public"

export const authClient = createAuthClient({
  basePath: publicConfig.authPath,
})
