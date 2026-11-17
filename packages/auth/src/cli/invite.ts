import { Effect, Match } from "effect"
import { Database, RegistrationInvitationStore } from "@flowmark/db/persistence"
import {
  withCommandDatabase,
  readLocalDevelopmentDatabaseUrl,
} from "@flowmark/db/commands"
import { Email, EmailError, emailSettings, resendLayer } from "@flowmark/email"
import { invite } from "../registration/invite.js"

// Uses explicitly supplied server settings; never loads a different environment
// or changes hosted configuration. This command does not migrate or seed.
const program = Effect.gen(function* () {
  const [email, ...extra] = process.argv.slice(2)
  if (!email || extra.length) {
    return yield* new EmailError({
      operation: "validation",
      reason: "invalid-message",
    })
  }
  const settings = yield* emailSettings(process.env)
  const url =
    settings.environment === "local"
      ? yield* readLocalDevelopmentDatabaseUrl()
      : process.env.DATABASE_URL
  const validOrigin = Match.value(settings.environment).pipe(
    Match.when(
      "production",
      () => settings.origin === "https://app.flowmark.dev",
    ),
    Match.when(
      "staging",
      () => settings.origin === "https://app.staging.flowmark.dev",
    ),
    Match.when(
      "preview",
      () =>
        ![
          "https://app.flowmark.dev",
          "https://app.staging.flowmark.dev",
        ].includes(settings.origin),
    ),
    Match.when("local", () =>
      ["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(settings.origin).hostname,
      ),
    ),
    Match.exhaustive,
  )
  const validTarget = yield* Effect.try({
    try: () => {
      if (!url) {
        return false
      }
      const target = new URL(url)
      return (
        validOrigin &&
        ["postgres:", "postgresql:"].includes(target.protocol) &&
        (settings.environment === "local" ||
          (target.hostname.endsWith(".neon.tech") &&
            process.env.NEON_BRANCH === settings.environment)) &&
        !process.env.DATABASE_MIGRATION_URL
      )
    },
    catch: () =>
      new EmailError({
        operation: "configuration",
        reason: "invalid-configuration",
      }),
  })
  if (!validTarget || !url) {
    return yield* new EmailError({
      operation: "configuration",
      reason: "invalid-configuration",
    })
  }
  const delivery = yield* Email
  const result = yield* withCommandDatabase(url, (db) =>
    invite(email, settings.origin).pipe(
      Effect.provide(RegistrationInvitationStore.layer),
      Effect.provideService(Database, db),
      Effect.provideService(Email, delivery),
    ),
  )
  yield* Effect.sync(() =>
    console.log(
      result === "invited"
        ? "Invitation sent. The link expires in 24 hours."
        : "Already invited or registered. No email sent.",
    ),
  )
}).pipe(
  Effect.provide(resendLayer(process.env)),
  Effect.catchCause(() =>
    Effect.sync(() => {
      console.error(
        "Invitation failed. Check the email, database target, and existing email settings. No automatic retry.",
      )
      process.exitCode = 1
    }),
  ),
)

await Effect.runPromise(program)
