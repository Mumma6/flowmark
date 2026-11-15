import { expect, it } from "vitest"
import { helpDestinations } from "../features/support/help-destinations"

it("keeps troubleshooting beside a configured docs page and always offers public reporting", () => {
  const destinations = helpDestinations(
    "https://docs.flowmark.dev/docs/introduction",
  )
  expect(destinations.map((destination) => destination.id)).toEqual([
    "documentation",
    "troubleshooting",
    "security-privacy",
    "product-issue",
    "private-support",
    "security-report",
  ])
  expect(destinations[1]?.href).toBe(
    "https://docs.flowmark.dev/docs/troubleshooting",
  )
  expect(destinations[2]?.href).toBe(
    "https://docs.flowmark.dev/docs/security-privacy",
  )
  expect(destinations[3]?.href).toBe(
    "https://github.com/Mumma6/flowmark/issues/new",
  )
  expect(destinations[5]?.href).toBe(
    "mailto:flowmark.dev@gmail.com?subject=Flowmark%20security%20report",
  )
})

it("omits doc siblings when the documentation URL is not a docs page", () => {
  expect(
    helpDestinations("https://docs.example/guide?tab=install").map(
      (destination) => destination.id,
    ),
  ).toEqual([
    "documentation",
    "product-issue",
    "private-support",
    "security-report",
  ])
})

it("omits doc siblings when the documentation URL cannot be parsed", () => {
  expect(
    helpDestinations("not a url").map((destination) => destination.href),
  ).toEqual([
    "not a url",
    "https://github.com/Mumma6/flowmark/issues/new",
    "mailto:flowmark.dev@gmail.com",
    "mailto:flowmark.dev@gmail.com?subject=Flowmark%20security%20report",
  ])
})
