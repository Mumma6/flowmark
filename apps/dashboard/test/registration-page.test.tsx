import { beforeEach, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ publicRegistration: false }))
vi.mock("../features/platform/config-server", () => ({
  publicRegistrationEnabled: () => state.publicRegistration,
}))
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))
vi.mock("../features/auth/auth-screen", () => ({ AuthScreen: () => null }))
import SignUpPage from "../app/(auth)/sign-up/page"

beforeEach(() => {
  state.publicRegistration = false
})
it("keeps bare Production signup closed after navigating away from an invite", async () => {
  await expect(
    SignUpPage({ searchParams: Promise.resolve({}) }),
  ).rejects.toThrow("redirect:/sign-in")
  await expect(
    SignUpPage({ searchParams: Promise.resolve({ invite: "invalid" }) }),
  ).rejects.toThrow("redirect:/sign-in")
})
it("passes the private link to the registration form", async () => {
  const token = "a".repeat(43)
  const page = await SignUpPage({
    searchParams: Promise.resolve({ invite: token }),
  })
  expect(page.props.invitationToken).toBe(token)
})
it("preserves Preview/Staging public registration", async () => {
  state.publicRegistration = true
  const page = await SignUpPage({ searchParams: Promise.resolve({}) })
  expect(page.props.invitationToken).toBeUndefined()
})
