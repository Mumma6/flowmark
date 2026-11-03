import { parseArgs } from "node:util"
import {
  readFileSync,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  writeFileSync,
  statSync,
  unlinkSync,
} from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Cause, Effect, Exit, Schema } from "effect"
import {
  assertFixtureConnection,
  withCommandDatabase,
} from "@flowmark/db/commands"
import { DatasetConflict } from "@flowmark/db/fixtures"
import {
  generate,
  GeneratorConfig,
  defaultSeed,
  summarize,
} from "../generator/generate.js"
import { resolveTarget, checkRuntime } from "../environment/target.js"
import { verifyStagingDeployments } from "../environment/deployment.js"
import { operateDataset } from "../lifecycle/dataset.js"
import { setupAccount } from "../provisioning/account.js"
import { makeAuthHttp } from "../provisioning/auth-http.js"

const root = fileURLToPath(new URL("../../../../", import.meta.url))
const State = Schema.Struct({
  environment: Schema.Literals(["local", "staging"]),
  projectId: Schema.String.check(Schema.isUUID()),
  neonProject: Schema.optional(Schema.String),
  config: GeneratorConfig,
})
const fail = (reason: string) => new DatasetConflict({ reason })
const io = <A>(operation: () => A) =>
  Effect.try({
    try: operation,
    catch: () =>
      fail(
        "Could not access private demo state/input. Secrets and raw filesystem errors were not logged.",
      ),
  })
const secretFile = (path: string) =>
  io(() => {
    if ((statSync(path).mode & 0o077) !== 0) {
      throw new Error("Private input required")
    }
    const value = readFileSync(path, "utf8").trim()
    if (!value) {
      throw new Error("Empty input")
    }
    return value
  })

const program = Effect.gen(function* () {
  const args = yield* Effect.try({
    try: () =>
      parseArgs({
        args: process.argv.slice(2).filter((arg) => arg !== "--"),
        allowPositionals: true,
        strict: true,
        options: {
          env: { type: "string" },
          reference: { type: "string" },
          seed: { type: "string" },
          "neon-project": { type: "string" },
          "password-stdin": { type: "boolean" },
          "confirm-staging-setup": { type: "boolean" },
          "confirm-staging-seed": { type: "boolean" },
          "confirm-staging-reset": { type: "boolean" },
          "confirm-local-reset": { type: "boolean" },
        },
      }),
    catch: () =>
      fail(
        "Unknown arguments. See packages/demo/README.md for the exact command contract.",
      ),
  })
  const [command] = args.positionals
  if (
    args.positionals.length !== 1 ||
    !["plan", "setup", "seed", "reset", "reseed", "status"].includes(
      command ?? "",
    )
  ) {
    return yield* fail("Choose plan, setup, seed, reset, reseed or status.")
  }
  if (command === "plan") {
    const reference = args.values.reference
    if (!reference) {
      return yield* fail(
        "Pass an explicit --reference UTC timestamp, for example 2026-11-03T12:00:00.000Z.",
      )
    }
    const dataset = yield* Effect.try({
      try: () => generate({ reference, seed: args.values.seed ?? defaultSeed }),
      catch: () =>
        fail(
          "Invalid generator configuration. Use an explicit UTC reference ending in .000Z.",
        ),
    })
    return summarize(dataset)
  }
  const environment = args.values.env
  if (environment !== "local" && environment !== "staging") {
    return yield* fail(
      "Pass --env local or --env staging. Production and Preview are forbidden.",
    )
  }
  yield* checkRuntime(environment, process.env)
  if (environment === "staging") {
    if (command === "setup" && !args.values["confirm-staging-setup"]) {
      return yield* fail(
        "Staging account setup requires approval and --confirm-staging-setup.",
      )
    }
    if (
      (command === "seed" || command === "reseed") &&
      !args.values["confirm-staging-seed"]
    ) {
      return yield* fail(
        "Staging seed requires approval and --confirm-staging-seed.",
      )
    }
    if (
      (command === "reset" || command === "reseed") &&
      !args.values["confirm-staging-reset"]
    ) {
      return yield* fail(
        "Destructive Staging reset requires approval for this dataset and --confirm-staging-reset.",
      )
    }
  }
  if (
    environment === "local" &&
    (command === "reset" || command === "reseed") &&
    !args.values["confirm-local-reset"]
  ) {
    return yield* fail(
      "Pass --confirm-local-reset to remove this dataset's local telemetry.",
    )
  }
  const directory = resolve(root, ".meridian-health")
  const stateFile = resolve(directory, `${environment}.json`)
  const keyFile = resolve(directory, `${environment}.key`)
  const state = existsSync(stateFile)
    ? yield* io(() =>
        Schema.decodeUnknownSync(Schema.fromJsonString(State))(
          readFileSync(stateFile, "utf8"),
        ),
      )
    : undefined
  if (state && state.environment !== environment) {
    return yield* fail("Saved state belongs to another environment.")
  }
  if (
    state &&
    ((args.values.reference &&
      args.values.reference !== state.config.reference) ||
      (args.values.seed && args.values.seed !== state.config.seed) ||
      (args.values["neon-project"] &&
        args.values["neon-project"] !== state.neonProject))
  ) {
    return yield* fail(
      "Saved configuration differs. Reset with its original configuration before changing the dataset window or seed.",
    )
  }
  if (
    command !== "setup" &&
    (args.values.reference || args.values.seed || args.values["neon-project"])
  ) {
    return yield* fail(
      "Lifecycle commands use saved configuration. Reset the existing dataset before changing its reference or seed.",
    )
  }
  const neonProject = state?.neonProject ?? args.values["neon-project"]
  const target = yield* resolveTarget(environment, root, neonProject)
  if (command === "setup") {
    if (environment === "staging") {
      yield* verifyStagingDeployments(root)
    }
    const config = state?.config ?? {
      reference: args.values.reference ?? "",
      seed: args.values.seed ?? defaultSeed,
    }
    yield* Effect.try({
      try: () => generate(config),
      catch: () =>
        fail("Setup requires a valid explicit --reference UTC timestamp."),
    })
    if (!args.values["password-stdin"] || process.stdin.isTTY) {
      return yield* fail(
        "Supply the password through a secure pipe with --password-stdin. Never use command arguments or exported environment variables for passwords.",
      )
    }
    const password = yield* io(() =>
      readFileSync(0, "utf8").replace(/\r?\n$/, ""),
    )
    yield* io(() => mkdirSync(directory, { recursive: true, mode: 0o700 }))
    if (!state && existsSync(keyFile)) {
      return yield* fail(
        "A key file already exists without matching state. Inspect it; it will not be overwritten.",
      )
    }
    const setup = yield* Effect.acquireUseRelease(
      io(() =>
        !existsSync(keyFile) ? openSync(keyFile, "wx", 0o600) : undefined,
      ),
      (reserved) =>
        withCommandDatabase(target.url, (db) =>
          Effect.gen(function* () {
            yield* assertFixtureConnection(db, target.url)
            const auth = yield* makeAuthHttp(target.dashboard)
            const result = yield* setupAccount(
              db,
              auth,
              password,
              state?.projectId,
            )
            // Write only through the exclusive descriptor; never replace an existing key file.
            if (result.key) {
              if (reserved === undefined) {
                return yield* fail(
                  "An existing private key file was preserved; retrieve a key through Settings.",
                )
              }
              yield* io(() => writeFileSync(reserved, result.key))
            }
            return result
          }),
        ),
      (reserved) =>
        reserved === undefined
          ? Effect.void
          : io(() => {
              closeSync(reserved)
              if (statSync(keyFile).size === 0) {
                unlinkSync(keyFile)
              }
            }).pipe(Effect.orDie),
    )
    if (!state) {
      yield* io(() =>
        writeFileSync(
          stateFile,
          JSON.stringify(
            {
              environment,
              projectId: setup.projectId,
              ...(neonProject ? { neonProject } : {}),
              config,
            },
            null,
            2,
          ) + "\n",
          { flag: "wx", mode: 0o600 },
        ),
      )
    }
    if (state && state.projectId !== setup.projectId) {
      return yield* fail(
        "Saved project and authenticated project differ. State was preserved.",
      )
    }
    return {
      environment,
      projectId: setup.projectId,
      created: setup.created,
      next: setup.key
        ? "Setup complete. Seed requires separate approval for Staging."
        : "Account/project preserved. If the private key file is missing/empty, create a write key through Settings and save it privately before seeding.",
    }
  }
  if (!state) {
    return yield* fail(
      "Run demo:setup first. Account provisioning is separate from telemetry generation.",
    )
  }
  const key = yield* secretFile(keyFile)
  const dataset = yield* Effect.try({
    try: () => generate(state.config),
    catch: () => fail("Invalid saved generator configuration."),
  })
  return yield* withCommandDatabase(
    target.url,
    (db) =>
      assertFixtureConnection(db, target.url).pipe(
        Effect.flatMap(() =>
          operateDataset(db, {
            projectId: state.projectId,
            key,
            dataset,
            operation: command as "seed" | "reset" | "reseed" | "status",
            onProgress: (runs, total) =>
              Effect.sync(() =>
                console.error(
                  `Meridian telemetry: ${runs}/${total} runs prepared.`,
                ),
              ),
          }),
        ),
      ),
    { prepare: true },
  )
})

const result = await Effect.runPromiseExit(program)
Exit.match(result, {
  onSuccess: (output) => console.log(JSON.stringify(output, null, 2)),
  onFailure: (cause) => {
    const error = cause.reasons.find(Cause.isFailReason)?.error
    console.error(
      error instanceof DatasetConflict
        ? error.reason
        : "Meridian command failed. No credentials or provider payloads were logged. Verify target identity and saved configuration; see packages/demo/README.md.",
    )
    process.exitCode = 1
  },
})
