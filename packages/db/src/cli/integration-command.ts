import { spawn, type ChildProcess } from "node:child_process"
import { appendFileSync } from "node:fs"
import { Effect } from "effect"
import { CommandExecutionError } from "../environment/error.js"

export const redactTestOutput = (value: string) =>
  value.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted database URL]")

function stopChild(child: ChildProcess, group: boolean) {
  if (
    !child.pid ||
    (!group && (child.exitCode !== null || child.signalCode !== null))
  ) {
    return
  }
  try {
    if (group) {
      process.kill(-child.pid, "SIGTERM")
    } else {
      child.kill("SIGTERM")
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
      throw error
    }
  }
}

export const integrationCommand = Effect.fn("integrationCommand")(function* (
  command: string,
  args: readonly string[],
  options: {
    cwd: string
    env: NodeJS.ProcessEnv
    log?: string
    detached?: boolean
    failed?: (code: number) => void
  },
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      let closed = false
      const child = yield* Effect.acquireRelease(
        Effect.try({
          try: () => {
            const child = spawn(command, [...args], {
              cwd: options.cwd,
              env: options.env,
              stdio: ["ignore", "pipe", "pipe"],
              detached: options.detached ?? false,
            })
            child.once("close", () => {
              closed = true
            })
            return child
          },
          catch: () =>
            new CommandExecutionError({
              reason: "Could not start integration command.",
              exitCode: 1,
            }),
        }),
        (child) =>
          Effect.tryPromise({
            try: () =>
              new Promise<void>((resolve, reject) => {
                if (closed || !child.pid) {
                  resolve()
                  return
                }
                child.once("close", () => {
                  clearTimeout(timer)
                  resolve()
                })
                const timer = setTimeout(() => {
                  try {
                    if (options.detached) {
                      process.kill(-child.pid!, "SIGKILL")
                    } else {
                      child.kill("SIGKILL")
                    }
                  } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
                      reject(error)
                    }
                  }
                }, 2000)
                try {
                  stopChild(child, options.detached ?? false)
                } catch (error) {
                  clearTimeout(timer)
                  reject(error)
                }
              }),
            catch: () =>
              new CommandExecutionError({
                reason: "Could not terminate an owned integration process.",
                exitCode: 1,
              }),
          }).pipe(
            Effect.tapError((error) =>
              Effect.sync(() => console.error(error.reason)),
            ),
            Effect.orDie,
          ),
      )
      yield* Effect.tryPromise({
        try: () =>
          new Promise<void>((resolve, reject) => {
            const output = (chunk: Buffer) => {
              try {
                const value = redactTestOutput(chunk.toString())
                process.stdout.write(value)
                if (options.log) {
                  appendFileSync(options.log, value)
                }
              } catch {
                reject(
                  new CommandExecutionError({
                    reason: "Integration output could not be recorded.",
                    exitCode: 1,
                  }),
                )
              }
            }
            child.stdout!.on("data", output)
            child.stderr!.on("data", output)
            child.once("error", () =>
              reject(
                new CommandExecutionError({
                  reason: "Integration command could not be executed.",
                  exitCode: 1,
                }),
              ),
            )
            child.once("close", (code, signal) => {
              const status = code ?? (signal === "SIGINT" ? 130 : 143)
              if (status === 0) {
                resolve()
              } else {
                options.failed?.(status)
                reject(
                  new CommandExecutionError({
                    reason: `Integration command failed with exit status ${status}.`,
                    exitCode: status,
                  }),
                )
              }
            })
          }),
        catch: (error) =>
          error instanceof CommandExecutionError
            ? error
            : new CommandExecutionError({
                reason: "Integration command output could not be recorded.",
                exitCode: 1,
              }),
      })
    }),
  )
})
