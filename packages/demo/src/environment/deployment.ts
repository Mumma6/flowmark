import { Effect, Schema } from "effect"
import { DatasetConflict } from "@flowmark/db/fixtures"
import { providerRead } from "./provider-read.js"

const Deployment = Schema.Struct({
  name: Schema.String,
  readyState: Schema.Literal("READY"),
  target: Schema.optional(Schema.NullOr(Schema.Literal("preview"))),
  meta: Schema.Struct({
    githubCommitRef: Schema.Literal("staging"),
    githubCommitSha: Schema.String.check(Schema.isPattern(/^[a-f0-9]{40}$/)),
  }),
})
/** Deployment metadata and the existing server-side database guards must agree before auth writes. */
export const checkStagingDeployments = Effect.fn(
  "Meridian.checkStagingDeployments",
)(function* (dashboard: unknown, api: unknown) {
  const records = yield* Effect.all(
    [dashboard, api].map((input) =>
      Schema.decodeUnknownEffect(Deployment)(input),
    ),
  ).pipe(
    Effect.mapError(
      () =>
        new DatasetConflict({
          reason:
            "Expected ready Staging deployments, built from the staging branch, before account provisioning.",
        }),
    ),
  )
  if (
    records[0]!.name !== "flowmark-dashboard" ||
    records[1]!.name !== "flowmark-api" ||
    records[0]!.meta.githubCommitSha !== records[1]!.meta.githubCommitSha
  ) {
    return yield* new DatasetConflict({
      reason:
        "Dashboard and API must be the intended Staging projects at the same reviewed revision.",
    })
  }
})

export const verifyStagingDeployments = Effect.fn(
  "Meridian.verifyStagingDeployments",
)(function* (root: string) {
  const records = yield* Effect.all(
    [
      "https://app.staging.flowmark.dev",
      "https://api.staging.flowmark.dev",
    ].map((url) =>
      providerRead(
        "vercel",
        [
          "api",
          `/v13/deployments/${new URL(url).hostname}`,
          "--method",
          "GET",
          "--scope",
          "mumma6s-projects",
        ],
        root,
      ),
    ),
    { concurrency: 2 },
  )
  yield* checkStagingDeployments(records[0], records[1])
})
