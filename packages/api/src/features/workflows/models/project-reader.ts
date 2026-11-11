export type ProjectReader =
  | { readonly _tag: "Key"; readonly header: string | null }
  | {
      readonly _tag: "User"
      readonly userId: string
      readonly projectId?: string
    }
  | {
      readonly _tag: "DelegatedUser"
      readonly userId: string
      readonly clientId: string
      readonly authorizationCodeId: string
      readonly projectId: string
    }
