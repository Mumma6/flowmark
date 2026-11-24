export type ProviderMode =
  "same" | "other" | "missing" | "none" | "late" | "fail"

export type ProviderAck =
  | {
      readonly kind: "acknowledged"
      readonly changeId: string | null
    }
  | { readonly kind: "timeout" }

export type Provider = {
  readonly acknowledge: (input: {
    readonly changeId: string
  }) => Promise<ProviderAck>
  readonly attempts: () => number
}

const otherChangeId = "other-change"

/** The sample provider. The payment service owns retries; this simulator does not. */
export function createProvider(mode: ProviderMode): Provider {
  let attempts = 0
  return {
    attempts: () => attempts,
    acknowledge: (input) => {
      attempts += 1
      if (mode === "fail") {
        return Promise.reject(new Error("provider rejected the request"))
      }
      if (mode === "none" || (mode === "late" && attempts === 1)) {
        return Promise.resolve({ kind: "timeout" })
      }
      if (mode === "other") {
        return Promise.resolve({
          kind: "acknowledged",
          changeId: otherChangeId,
        })
      }
      if (mode === "missing") {
        return Promise.resolve({ kind: "acknowledged", changeId: null })
      }
      return Promise.resolve({
        kind: "acknowledged",
        changeId: input.changeId,
      })
    },
  }
}
