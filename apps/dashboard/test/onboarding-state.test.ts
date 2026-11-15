import { describe, expect, it } from "vitest"
import {
  hasServerWriteKey,
  initialSetupStep,
  setupSecretForProject,
} from "../features/onboarding/onboarding-state"

describe("selected-project setup state", () => {
  it("resumes persisted progress over an old URL while keeping review links explicit", () => {
    expect(initialSetupStep("instrument", "key", false)).toBe("instrument")
    expect(initialSetupStep(undefined, "run", false)).toBe("project")
    expect(initialSetupStep("run", "key", true)).toBe("key")
  })
  it("requires a server write key rather than a read-only key list", () => {
    expect(hasServerWriteKey([])).toBe(false)
    expect(hasServerWriteKey([{ permission: "read" }])).toBe(false)
    expect(
      hasServerWriteKey([{ permission: "read" }, { permission: "write" }]),
    ).toBe(true)
  })
  it("retains a newly created secret until its project refetch arrives without showing it for another project", () => {
    const value = {
      id: "key",
      name: "Setup",
      prefix: "synthetic",
      secret: "synthetic-one-time-key",
    }
    const pending = { projectId: "new-project", value }
    expect(setupSecretForProject(pending, undefined)).toBeNull()
    expect(setupSecretForProject(pending, "previous-project")).toBeNull()
    expect(setupSecretForProject(pending, "new-project")).toBe(value)
    expect(setupSecretForProject(null, "new-project")).toBeNull()
  })
})
