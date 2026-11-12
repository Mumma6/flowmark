import { TRPCError } from "@trpc/server"
import { Effect } from "effect"
import { serverOrigins } from "../../server-env"
import { t } from "./context"

export const lifecycleMutation = t.procedure.use(async ({ ctx, next }) => {
  const { dashboardOrigin } = await Effect.runPromise(serverOrigins())
  if (ctx.request.headers.get("origin") !== dashboardOrigin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A trusted Studio origin is required.",
    })
  }
  return next()
})
