type OnboardingStep = "project" | "key" | "instrument" | "run"

export const steps: ReadonlyArray<{
  readonly id: OnboardingStep
  readonly title: string
}> = [
  { id: "project", title: "Create a project" },
  { id: "key", title: "Save your ingestion key" },
  { id: "instrument", title: "Instrument your application" },
  { id: "run", title: "See your first execution" },
]

export const stepIndex = (value: string): number => {
  // Existing accounts may resume the former manual installation step.
  const id = value === "install" ? "instrument" : value
  const index = steps.findIndex((step) => step.id === id)
  return index >= 0 ? index : 0
}
