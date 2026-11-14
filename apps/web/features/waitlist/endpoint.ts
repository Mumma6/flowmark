import {
  isProductionHost,
  isStagingGitBranch,
  isStagingHost,
  previewDashboardOrigin,
} from "@flowmark/db/environment"
import { appUrl } from "../../app/components/site-links"

/** Reuse sibling-preview isolation; a preview must never submit to Production. */
export const waitlistEndpoint = (
  env: NodeJS.ProcessEnv = process.env,
): string | undefined => {
  const preview = env.VERCEL_ENV === "preview"
  const staging = isStagingGitBranch(env)
  const origin = preview && !staging ? previewDashboardOrigin(env) : appUrl
  if (!origin) {
    return undefined
  }
  const url = new URL("/api/waitlist", origin)
  if (
    preview &&
    (isProductionHost(url.hostname) ||
      (staging && !isStagingHost(url.hostname)))
  ) {
    return undefined
  }
  return url.href
}
