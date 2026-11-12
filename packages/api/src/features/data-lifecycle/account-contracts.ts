export interface AccountErasureOperation {
  readonly id: string
  readonly state: "previewed" | "purging" | "live_data_deleted" | "cancelled"
  readonly counts: {
    readonly projects: number
    readonly runs: number
    readonly events: number
    readonly apiKeys: number
    readonly oauthClients: number
    readonly delegatedGrants: number
    readonly browserKeys: number
    readonly previewProjects: ReadonlyArray<{
      readonly id: string
      readonly name: string
    }>
  }
  readonly completedProjects: number
  readonly phase: number
  readonly failureCode: string | null
  readonly expiresAt: string
  readonly capabilityExpiresAt: string
}
