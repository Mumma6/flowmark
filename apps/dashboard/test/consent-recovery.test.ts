import { expect, it } from "vitest"
import {
  ConsentHttpError,
  consentRecoveryMessage,
} from "../features/connect/consent/consent-browser"

it("keeps a stale consent request distinct from a missing session", () => {
  const signedOut = new ConsentHttpError({
    status: 401,
    reason: "Sign in to review this request.",
  })
  const stale = new ConsentHttpError({
    status: 400,
    reason:
      "The request is stale, the account changed, or authorization is unavailable. Reload or restart from your client.",
  })
  expect(consentRecoveryMessage(signedOut)).toBe(signedOut.reason)
  expect(consentRecoveryMessage(stale)).toBe(stale.reason)
  expect(consentRecoveryMessage(signedOut)).not.toBe(
    consentRecoveryMessage(stale),
  )
  expect(consentRecoveryMessage(new Error("nope"))).not.toBe(stale.reason)
})
