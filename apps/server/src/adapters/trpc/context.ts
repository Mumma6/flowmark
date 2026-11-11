import { initTRPC } from "@trpc/server"

export const t = initTRPC
  .context<{
    request: Request
  }>()
  .create()
