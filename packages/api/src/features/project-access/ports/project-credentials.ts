import { Context, Redacted, type Effect } from "effect"
import type { PersistenceError } from "../../../errors.js"

export interface BrowserCredential {
  readonly id: string
  readonly projectId: string
  readonly allowedOrigins: ReadonlyArray<string>
}

export interface ProjectCredentialsService {
  readonly authenticateBrowser: (
    key: Redacted.Redacted<string>,
  ) => Effect.Effect<BrowserCredential | undefined, PersistenceError>
  readonly browserOriginAllowed: (
    origin: string,
  ) => Effect.Effect<boolean, PersistenceError>
  readonly consumeBrowserQuota: (
    keyId: string,
  ) => Effect.Effect<boolean, PersistenceError>
  readonly authenticate: (
    key: Redacted.Redacted<string>,
    permission: "read" | "write",
  ) => Effect.Effect<string | undefined, PersistenceError>
  readonly projectForUser: (
    userId: string,
  ) => Effect.Effect<string | undefined, PersistenceError>
  readonly addOwner: (
    userId: string,
    projectId: string,
  ) => Effect.Effect<void, PersistenceError>
  readonly createOwnedProject: (
    userId: string,
    names: { readonly workspace: string; readonly project: string },
  ) => Effect.Effect<
    {
      readonly projectId: string
      readonly writeKey: string
      readonly readKey: string
    },
    PersistenceError
  >
}

export class ProjectCredentials extends Context.Tag(
  "@flowmark/api/ProjectCredentials",
)<ProjectCredentials, ProjectCredentialsService>() {}
