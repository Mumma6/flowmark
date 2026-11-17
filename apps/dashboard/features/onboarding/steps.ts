type OnboardingStep = "project" | "key" | "instrument"

export const steps: ReadonlyArray<{
  readonly id: OnboardingStep
  readonly title: string
}> = [
  { id: "project", title: "Create a project" },
  { id: "key", title: "Save your ingestion key" },
  { id: "instrument", title: "Get setup instructions" },
]

export const stepIndex = (value: string): number => {
  // Resume former install/waiting steps at the final instructions; never wait for telemetry.
  const id = value === "install" || value === "run" ? "instrument" : value
  const index = steps.findIndex((step) => step.id === id)
  return index >= 0 ? index : 0
}
