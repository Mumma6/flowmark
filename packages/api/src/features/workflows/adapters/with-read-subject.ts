import { Effect, Match } from "effect"
import { ProjectReadSubject, hashApiKey } from "@flowmark/db/persistence"
import { CurrentProjectReader } from "../models/current-project-reader.js"

export const withReadSubject = <A, E, R>(operation: Effect.Effect<A, E, R>) =>
  Effect.flatMap(CurrentProjectReader, (reader) =>
    operation.pipe(
      Effect.provideService(
        ProjectReadSubject,
        reader === undefined
          ? undefined
          : Match.value(reader).pipe(
              Match.tag("Key", ({ header }) => ({
                kind: "key" as const,
                keyHash: hashApiKey(header?.slice(7) ?? ""),
              })),
              Match.tag("User", ({ userId }) => ({
                kind: "user" as const,
                userId,
              })),
              Match.tag(
                "DelegatedUser",
                ({ userId, clientId, authorizationCodeId }) => ({
                  kind: "delegated" as const,
                  userId,
                  clientId,
                  authorizationCodeId,
                }),
              ),
              Match.exhaustive,
            ),
      ),
    ),
  )
