import { createAuthClient } from "better-auth/react"
import { publicConfig } from "../config/public"

export const authClient = createAuthClient({
  basePath: publicConfig.authPath,
})
