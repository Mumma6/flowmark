type OnboardingStep = "project" | "key" | "install" | "instrument" | "run"

export const steps: ReadonlyArray<{
  readonly id: OnboardingStep
  readonly title: string
}> = [
  { id: "project", title: "Create a project" },
  { id: "key", title: "Save your write key" },
  { id: "install", title: "Install the SDK" },
  { id: "instrument", title: "Mark one process" },
  { id: "run", title: "Open your first run" },
]

export const stepIndex = (value: string): number => {
  const index = steps.findIndex((step) => step.id === value)
  return index >= 0 ? index : 0
}
