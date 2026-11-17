import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import { Array, Data, Effect, Schema } from "effect"

export class InvitationCommandError extends Data.TaggedError(
  "InvitationCommandError",
)<{
  readonly reason: string
}> {}

const State = Schema.Struct({
  deployment: Schema.Struct({
    resources: Schema.Array(
      Schema.Struct({
        urn: Schema.String,
        type: Schema.String,
        outputs: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
      }),
    ),
  }),
})
const StateString = Schema.Union([
  Schema.String,
  Schema.Struct({ plaintext: Schema.String }),
])

/** Read the existing managed deployment; never create another secret catalog. */
export const productionInvitationEnvironment = Effect.fn(
  "Invitation.productionEnvironment",
)(function* (input: unknown) {
  const state = yield* Schema.decodeUnknownEffect(State)(input).pipe(
    Effect.mapError(
      () =>
        new InvitationCommandError({
          reason: "Pulumi returned an invalid Production state.",
        }),
    ),
  )
  const resource = Effect.fn("Invitation.resource")(function* (
    name: string,
    type: string,
  ) {
    const found = Array.filter(
      state.deployment.resources,
      (entry) =>
        entry.type === type &&
        entry.urn ===
          `urn:pulumi:production::flowmark-infrastructure::${type}::${name}`,
    )
    if (found.length !== 1 || !found[0].outputs) {
      return yield* new InvitationCommandError({
        reason: `Missing managed Production resource: ${name}.`,
      })
    }
    return found[0].outputs
  })
  const value = Effect.fn("Invitation.value")(function* (
    source: Record<string, unknown>,
    key: string,
  ) {
    const decoded = yield* Schema.decodeUnknownEffect(StateString)(
      source[key],
    ).pipe(
      Effect.mapError(
        () =>
          new InvitationCommandError({
            reason: `Pulumi Production setting ${key} is unavailable.`,
          }),
      ),
    )
    if (typeof decoded === "string") {
      return decoded
    }
    // Checkpoint exports encode each decrypted secret as a JSON string.
    const plaintext = yield* Effect.try({
      try: () => JSON.parse(decoded.plaintext) as unknown,
      catch: () =>
        new InvitationCommandError({
          reason: `Pulumi Production setting ${key} could not be decoded.`,
        }),
    })
    return yield* Schema.decodeUnknownEffect(Schema.String)(plaintext).pipe(
      Effect.mapError(
        () =>
          new InvitationCommandError({
            reason: `Pulumi Production setting ${key} is not a string.`,
          }),
      ),
    )
  })
  const branch = yield* resource("neon-production", "neon:index/branch:Branch")
  const endpoint = yield* resource(
    "neon-production-compute",
    "neon:index/endpoint:Endpoint",
  )
  const role = yield* resource("neon-production-owner", "neon:index/role:Role")
  const database = yield* resource(
    "neon-production-database",
    "neon:index/database:Database",
  )
  const sendingKey = yield* resource(
    "api-production-resend-sending-key",
    "resend:index/apiKey:ApiKey",
  )
  if (
    branch.name !== "production" ||
    !branch.id ||
    endpoint.branchId !== branch.id ||
    role.branchId !== branch.id ||
    database.branchId !== branch.id ||
    database.ownerName !== role.name ||
    sendingKey.permission !== "sending_access" ||
    !sendingKey.domainId
  ) {
    return yield* new InvitationCommandError({
      reason:
        "Pulumi Production database or sending-key identity does not match the managed deployment.",
    })
  }
  const binding = Effect.fn("Invitation.binding")(function* (name: string) {
    const entry = yield* resource(
      `api-production-${name.toLowerCase().replaceAll("_", "-")}`,
      "vercel:index/projectEnvironmentVariable:ProjectEnvironmentVariable",
    )
    if (
      entry.key !== name ||
      !globalThis.Array.isArray(entry.targets) ||
      !entry.targets.includes("production")
    ) {
      return yield* new InvitationCommandError({
        reason: `Pulumi binding ${name} is not scoped to Production.`,
      })
    }
    return yield* value(entry, "value")
  })
  const host = yield* value(endpoint, "hostPooling")
  const username = yield* value(role, "name")
  const password = yield* value(role, "password")
  const databaseName = yield* value(database, "name")
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.neon\.tech$/.test(host)) {
    return yield* new InvitationCommandError({
      reason: "Pulumi Production database host is invalid.",
    })
  }
  return {
    DATABASE_URL: `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}/${encodeURIComponent(databaseName)}?sslmode=require`,
    NEON_BRANCH: "production",
    RESEND_API_KEY: yield* value(sendingKey, "token"),
    BETTER_AUTH_URL: yield* binding("BETTER_AUTH_URL"),
    FLOWMARK_EMAIL_FROM: yield* binding("FLOWMARK_EMAIL_FROM"),
    FLOWMARK_EMAIL_REPLY_TO: yield* binding("FLOWMARK_EMAIL_REPLY_TO"),
    FLOWMARK_EMAIL_ENVIRONMENT: yield* binding("FLOWMARK_EMAIL_ENVIRONMENT"),
  } satisfies NodeJS.ProcessEnv
})

const settings = [
  "DATABASE_URL",
  "NEON_BRANCH",
  "RESEND_API_KEY",
  "BETTER_AUTH_URL",
  "FLOWMARK_EMAIL_FROM",
  "FLOWMARK_EMAIL_REPLY_TO",
  "FLOWMARK_EMAIL_ENVIRONMENT",
] as const
const execute = promisify(execFile)

export const readInvitationEnvironment = Effect.fn("Invitation.environment")(
  function* (env: NodeJS.ProcessEnv = process.env) {
    if (env.DATABASE_MIGRATION_URL) {
      return yield* new InvitationCommandError({
        reason:
          "Unset DATABASE_MIGRATION_URL before inviting; this command uses the runtime database only.",
      })
    }
    if (settings.some((name) => env[name] !== undefined)) {
      const required =
        env.FLOWMARK_EMAIL_ENVIRONMENT === "local"
          ? settings.filter((name) => name !== "NEON_BRANCH")
          : settings
      const missing = required.filter((name) => !env[name]?.trim())
      if (missing.length) {
        return yield* new InvitationCommandError({
          reason: `Missing invitation settings: ${missing.join(", ")}. Supply a complete explicit environment, or unset partial overrides to use the existing Pulumi Production configuration.`,
        })
      }
      return env
    }
    const output = yield* Effect.tryPromise({
      try: (signal) =>
        execute(
          "pulumi",
          ["stack", "export", "--stack", "production", "--show-secrets"],
          {
            cwd: fileURLToPath(
              new URL("../../../../infrastructure/", import.meta.url),
            ),
            env,
            signal,
            encoding: "utf8",
            maxBuffer: 10 * 1024 * 1024,
            timeout: 30000,
          },
        ),
      catch: () =>
        new InvitationCommandError({
          reason:
            "Could not read the existing Pulumi Production configuration. Install/sign in to the Pulumi CLI, or supply the explicit invitation environment. No invitation was created.",
        }),
    })
    const parsed = yield* Effect.try({
      try: () => JSON.parse(output.stdout) as unknown,
      catch: () =>
        new InvitationCommandError({
          reason: "Pulumi returned invalid JSON. No invitation was created.",
        }),
    })
    return yield* productionInvitationEnvironment(parsed)
  },
)
