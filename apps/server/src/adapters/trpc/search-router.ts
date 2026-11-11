import { Effect, Schema } from "effect"
import { GetProjectWorkflowData } from "@flowmark/api"
import { t } from "./context"
import { readQuery } from "./execution"

export const searchRouter = t.router({
  project: t.procedure
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({
          query: Schema.String.check(
            Schema.isMinLength(1),
            Schema.isMaxLength(200),
          ),
        }),
      ),
    )
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.search(reader, input.query),
        ),
      ),
    ),
})
