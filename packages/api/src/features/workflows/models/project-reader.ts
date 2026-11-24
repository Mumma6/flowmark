import { Data } from "effect"

export type ProjectReader = Data.TaggedEnum<{
  Key: { readonly header: string | null }
  User: {
    readonly userId: string
    readonly projectId?: string
  }
  DelegatedUser: {
    readonly userId: string
    readonly clientId: string
    readonly authorizationCodeId: string
    readonly projectId: string
  }
}>

const readers = Data.taggedEnum<ProjectReader>()

export const Key = readers.Key
export const User = readers.User
export const DelegatedUser = readers.DelegatedUser
export const isUserReader = readers.$is("User")
export const readerPrincipal = readers.$match({
  DelegatedUser: (delegated) =>
    [
      "DelegatedUser",
      delegated.clientId,
      delegated.authorizationCodeId,
    ] as const,
  User: () => ["User"] as const,
  Key: () => ["Key"] as const,
})
