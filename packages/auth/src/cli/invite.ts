import { Effect, Match } from "effect"
import { Database, RegistrationInvitationStore } from "@flowmark/db/persistence"
import {
  withCommandDatabase,
  readLocalDevelopmentDatabaseUrl,
} from "@flowmark/db/commands"
import { EmailError, emailSettings, resendLayer } from "@flowmark/email"
import { invite } from "../registration/invite.js"
import { hashInvitationToken } from "../registration/invitation-token.js"
import {
  InvitationCommandError,
  readInvitationEnvironment,
} from "./invitation-environment.js"

// Operator-only configuration reads stay in memory. No migrate, seed, or hosted settings writes.
const program = Effect.gen(function* () {
  const [email, ...extra] = process.argv.slice(2)
  const check = extra.length === 1 && extra[0] === "--check"
  if (!email || email.startsWith("--") || (extra.length && !check)) {
    return yield* new InvitationCommandError({
      reason: "Usage: pnpm invite user@example.com [--check]",
    })
  }
  const environment: NodeJS.ProcessEnv = yield* readInvitationEnvironment()
  const settings = yield* emailSettings(environment)
  const url =
    settings.environment === "local"
      ? yield* readLocalDevelopmentDatabaseUrl(environment)
      : environment.DATABASE_URL
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
            environment.NEON_BRANCH === settings.environment)) &&
        !environment.DATABASE_MIGRATION_URL
      )
    },
    catch: () =>
      new EmailError({
        operation: "configuration",
        reason: "invalid-configuration",
      }),
  })
  if (!validTarget || !url) {
    return yield* new InvitationCommandError({
      reason:
        "Invitation target does not match its email environment. Check NEON_BRANCH, DATABASE_URL and BETTER_AUTH_URL; DATABASE_MIGRATION_URL must be unset.",
    })
  }
  yield* Effect.sync(() =>
    console.log(
      `Invitation target: ${settings.environment} (${settings.origin}).`,
    ),
  )
  const result = yield* withCommandDatabase(url, (db) =>
    (check
      ? RegistrationInvitationStore.use((store) =>
          store.get(email, hashInvitationToken("configuration-check")),
        ).pipe(Effect.as("checked" as const))
      : invite(email, settings.origin).pipe(
          Effect.provide(resendLayer(environment)),
        )
    ).pipe(
      Effect.provide(RegistrationInvitationStore.layer),
      Effect.provideService(Database, db),
    ),
  )
  yield* Effect.sync(() =>
    console.log(
      Match.value(result).pipe(
        Match.when(
          "checked",
          () =>
            "Configuration and invitation database check passed. No invitation created and no email sent.",
        ),
        Match.when(
          "invited",
          () => "Invitation sent. The link expires in 24 hours.",
        ),
        Match.when(
          "already-invited-or-registered",
          () => "Already invited or registered. No email sent.",
        ),
        Match.exhaustive,
      ),
    ),
  )
}).pipe(
  Effect.catchTags({
    InvitationCommandError: (error) =>
      Effect.sync(() => {
        console.error(error.reason)
        process.exitCode = 1
      }),
    EmailError: (error) =>
      Effect.sync(() => {
        console.error(
          `Invitation email failed: ${error.operation}/${error.reason}${error.status ? ` (HTTP ${error.status})` : ""}. No automatic retry.`,
        )
        process.exitCode = 1
      }),
    DatabaseError: (error) =>
      Effect.sync(() => {
        console.error(
          `Invitation database operation failed: ${error.operation}. Check the target connection and that migration 0036 is applied. No automatic retry.`,
        )
        process.exitCode = 1
      }),
  }),
  Effect.catchCause(() =>
    Effect.sync(() => {
      console.error(
        "Invitation failed unexpectedly. No automatic retry; credentials and private links are never logged.",
      )
      process.exitCode = 1
    }),
  ),
)

await Effect.runPromise(program)
