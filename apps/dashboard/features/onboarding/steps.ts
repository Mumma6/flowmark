type OnboardingStep = "project" | "key" | "install" | "instrument" | "run"

export const steps: ReadonlyArray<{
  readonly id: OnboardingStep
  readonly title: string
}> = [
  { id: "project", title: "Create a project" },
  { id: "key", title: "Secure your write key" },
  { id: "install", title: "Install the SDK" },
  { id: "instrument", title: "Instrument a process" },
  { id: "run", title: "Explore your evidence" },
]

export const stepIndex = (value: string): number => {
  const index = steps.findIndex((step) => step.id === value)
  return index >= 0 ? index : 0
}
