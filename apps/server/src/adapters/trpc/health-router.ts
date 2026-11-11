import { t } from "./context"

export const healthRouter = t.router({
  check: t.procedure.query(() => ({
    status: "ok" as const,
    service: "flowmark-api",
  })),
})
