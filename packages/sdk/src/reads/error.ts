export class FlowmarkReadError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    // Server/proxy messages may contain sensitive information. Public failures
    // expose a stable code and status, never response bodies or credential URLs.
    super(`Flowmark read failed: ${code}.`)
    this.name = "FlowmarkReadError"
  }
}
