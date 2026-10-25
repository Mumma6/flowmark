export interface ProjectSummary {
  readonly id: string
  readonly name: string
  readonly createdAt: string
}

export interface ApiKeySummary {
  readonly id: string
  readonly name: string
  readonly prefix: string
  readonly permission: "read" | "write"
  readonly createdAt: string
}

export interface BrowserKeySummary {
  readonly id: string
  readonly name: string
  readonly prefix: string
  readonly allowedOrigins: ReadonlyArray<string>
  readonly createdAt: string
}

export interface CreatedSecret {
  readonly id: string
  readonly name: string
  readonly prefix: string
  readonly secret: string
}
