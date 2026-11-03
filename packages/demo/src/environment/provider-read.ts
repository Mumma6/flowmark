import { execFile } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { Array, Effect, Option, Schema } from "effect"
import { DatasetConflict } from "@flowmark/db/fixtures"

const packages = {
  neon: { version: "8.16.0", binary: "dist/cli.js" },
  vercel: { version: "65.9.0", binary: "dist/vc.js" },
} as const

/** Locate already-installed executable code only; authentication stays inside the provider CLI. */
export const providerRead = Effect.fn("Meridian.providerRead")(function* (
  name: keyof typeof packages,
  args: readonly string[],
  root: string,
) {
  const selected = packages[name]
  const cached = yield* Effect.try({
    try: () => {
      const directory = join(
        process.env.npm_config_cache ?? join(homedir(), ".npm"),
        "_npx",
      )
      if (!existsSync(directory)) {
        return Option.none<string>()
      }
      return Array.findFirst(
        Array.map(readdirSync(directory).sort(), (entry) =>
          join(directory, entry, "node_modules", name),
        ),
        (path) => {
          const manifest = join(path, "package.json")
          return (
            existsSync(manifest) &&
            Schema.decodeUnknownSync(
              Schema.fromJsonString(Schema.Struct({ version: Schema.String })),
            )(readFileSync(manifest, "utf8")).version === selected.version
          )
        },
      )
    },
    catch: () =>
      new DatasetConflict({
        reason: `Could not locate the installed ${name} CLI.`,
      }),
  })
  const command = Option.match(cached, {
    onSome: (path) => ({
      executable: process.execPath,
      args: [join(path, selected.binary), ...args],
    }),
    onNone: () => ({
      executable: "npx",
      args: ["--no-install", `${name}@${selected.version}`, ...args],
    }),
  })
  const result = yield* Effect.tryPromise({
    try: () =>
      promisify(execFile)(command.executable, command.args, {
        cwd: root,
        timeout: 30000,
        maxBuffer: 2 * 1024 * 1024,
      }),
    catch: () =>
      new DatasetConflict({
        reason: `Read-only ${name} inspection failed. Use the existing authenticated CLI (${selected.version}).`,
      }),
  })
  return yield* Schema.decodeUnknownEffect(
    Schema.fromJsonString(Schema.Unknown),
  )(result.stdout).pipe(
    Effect.mapError(
      () =>
        new DatasetConflict({
          reason: `Unexpected ${name} inspection response.`,
        }),
    ),
  )
})
