export const scenarioIds = [
  "lifecycle",
  "context",
  "handled-error",
  "terminal-failure",
  "operations",
  "operation-failure",
  "deferred-completion",
  "progress",
  "correlation",
  "continue",
] as const

export type ScenarioId = (typeof scenarioIds)[number]

export const scenarios: {
  id: ScenarioId
  group: string
  title: string
  methods: string
  expected: string
}[] = [
  {
    id: "lifecycle",
    group: "Runs and data",
    title: "Basic lifecycle",
    methods: "workflow → step → done · runId",
    expected: "Completed run with one milestone. Later markers are ignored.",
  },
  {
    id: "context",
    group: "Runs and data",
    title: "Context and business result",
    methods: "properties · setProperties · step(properties) · done(result)",
    expected:
      "Run context changes from pending to saved. Step data stays local to the milestone.",
  },
  {
    id: "handled-error",
    group: "Errors",
    title: "Recover from an error",
    methods: "error({ handled: true }) → done",
    expected: "Completed run containing a handled error; no failed workflow.",
  },
  {
    id: "terminal-failure",
    group: "Errors",
    title: "Terminal failure",
    methods: "fail({ code, message, retryable })",
    expected: "Failed run. Later done() must not change its status.",
  },
  {
    id: "operations",
    group: "Operations and progress",
    title: "Manual and callback operations",
    methods: "operation(name) · operation(name, callback)",
    expected: "Two operations with distinct IDs and measured durations.",
  },
  {
    id: "operation-failure",
    group: "Operations and progress",
    title: "Operation callback rejection",
    methods: "operation(callback) rejection → error → done",
    expected:
      "Failed operation, original application error caught, workflow Completed.",
  },
  {
    id: "deferred-completion",
    group: "Operations and progress",
    title: "Complete with operations still open",
    methods: "operation × 2 → done(result) → operation.done",
    expected:
      "Completion appears after both operations close, preserving the first result.",
  },
  {
    id: "progress",
    group: "Operations and progress",
    title: "Absolute progress snapshots",
    methods: "progress({ completed, total, unit })",
    expected:
      "Snapshots 0/3, 1/3, 2/3, 3/3 rows. These are absolute values, not increments.",
  },
  {
    id: "correlation",
    group: "Related runs",
    title: "Parent and correlated child",
    methods: "runId · correlationId · parentRunId",
    expected:
      "Two independently completed runs linked in the dashboard. No automatic tracing.",
  },
  {
    id: "continue",
    group: "Related runs",
    title: "Continue one run across requests",
    methods: "workflow({ id }) twice · step · done",
    expected:
      "One execution. Later workflow({ id }) adds markers; a second started is ignored.",
  },
]
