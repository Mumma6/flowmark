import { Effect, Exit, Layer } from "effect"
import type { FlowmarkDatabase } from "@flowmark/db"
import { AccountEmailChangeStore, Database } from "@flowmark/db/persistence"
import {
  AccountEmailRuntime,
  type AccountEmailRuntimeService,
} from "./types.js"
import { AccountEmailChange } from "./coordinator.js"
import { emailChangeHttp, emailChangeHttpFailure } from "./http.js"

export const createAccountEmailChanges = (
  db: FlowmarkDatabase,
  runtime: AccountEmailRuntimeService,
) => {
  const dependencies = Layer.mergeAll(
    Layer.succeed(AccountEmailRuntime, runtime),
    AccountEmailChangeStore.layer.pipe(
      Layer.provide(Layer.succeed(Database, db)),
    ),
  )
  const layer = AccountEmailChange.layer.pipe(Layer.provide(dependencies))
  return {
    handle: async (request: Request, path: string) => {
      const result = await Effect.runPromiseExit(
        emailChangeHttp(
          request,
          path,
          runtime.baseURL,
          runtime.trustedOrigins,
        ).pipe(Effect.provide(layer)),
        { signal: request.signal },
      )
      return Exit.match(result, {
        onSuccess: (value) => value,
        onFailure: (cause) =>
          emailChangeHttpFailure(request, path, runtime.baseURL, cause),
      })
    },
  }
}
