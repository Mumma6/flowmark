import { describe, expect, it } from "vitest"
import { coverageDestination } from "../features/coverage/coverage-destination"

describe("coverage destinations", () => {
  it("names the same statuses as an agent read and follows a repair without a payload", () => {
    expect(
      coverageDestination({
        status: "stale",
        question: "booking.receipt-link",
        repair: "https://github.com/example/bookings/pull/14",
      }),
    ).toMatchObject({
      status: "stale",
      question: "booking.receipt-link",
      action: {
        href: "https://github.com/example/bookings/pull/14",
        label: "Open the repair pull request",
      },
    })
    expect(
      coverageDestination({
        status: "revoked",
        question: "booking.receipt-link",
        repair: "https://github.com/example/bookings/pull/14?token=secret",
      }).action,
    ).toEqual({ href: "/connect", label: "Review access" })
    expect(
      coverageDestination({
        status: "forbidden",
        question: "not a question",
      }),
    ).toMatchObject({ question: null, action: { href: "/connect" } })
  })

  it("keeps an unknown status on the coverage index", () => {
    expect(coverageDestination({ status: "analytics" }).title).toBe(
      "Coverage and exceptions",
    )
  })
})
