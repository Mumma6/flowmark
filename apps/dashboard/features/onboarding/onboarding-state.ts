import { Array, Option, pipe } from "effect"
import type { CreatedSecret } from "../projects/types"

export const initialSetupStep = (
  persisted: string | undefined,
  requested: string | undefined,
  review: boolean,
) => (review ? (requested ?? "project") : (persisted ?? "project"))

export const hasServerWriteKey = (
  keys: readonly { readonly permission: "read" | "write" }[],
) => Array.some(keys, (key) => key.permission === "write")

export interface ScopedSetupSecret {
  readonly projectId: string
  readonly value: CreatedSecret
}

/** Project creation can complete before the project-list refetch. Never clear its new secret in an effect. */
export const setupSecretForProject = (
  secret: ScopedSetupSecret | null,
  projectId: string | undefined,
) =>
  pipe(
    Option.fromNullishOr(secret),
    Option.filter((value) => value.projectId === projectId),
    Option.map((value) => value.value),
    Option.getOrNull,
  )
