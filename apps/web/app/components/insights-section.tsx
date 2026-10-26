import { overlineClassName, sectionTitleClassName, shellClassName } from "./shell"

const capabilities = [
  {
    title: "Investigation",
    items: [
      {
        name: "Timeline and operations",
        detail:
          "Milestones, measured work, overlap, and where the time went — only what was recorded.",
      },
      {
        name: "Progress and recovery",
        detail:
          "Last-reported progress, handled errors beside completed runs, and terminal outcomes that stay honest.",
      },
      {
        name: "The shape of a run",
        detail:
          "A waterfall of overlapping operations and stages. No invented orchestration graph.",
      },
      {
        name: "Deep comparison",
        detail:
          "Differences in operation time, order, progress, failure codes, and reported result — not only overall duration.",
      },
    ],
  },
  {
    title: "Intelligence",
    items: [
      {
        name: "What changed, and where",
        detail:
          "A slower p95 names the operations that slowed. A falling success rate names the failure codes that account for it.",
      },
      {
        name: "Reported outcomes over time",
        detail:
          "Follow imported, skipped, or rejected counts across executions. Every number links back to the runs behind it.",
      },
      {
        name: "Find the execution",
        detail:
          "Ask for runs by result field, failure code, operation, release, or a reference the application chose to report.",
      },
      {
        name: "A signal worth opening",
        detail:
          "Explainable changes in duration, failures, volume, or outcomes, with the uncertainty visible.",
      },
    ],
  },
] as const

export function InsightsSection() {
  return (
    <section
      id="capabilities"
      className="border-t border-border py-16 sm:py-24"
      aria-labelledby="capabilities-title"
    >
      <div className={shellClassName}>
        <div className="max-w-2xl">
          <p className={overlineClassName}>In the dashboard</p>
          <h2
            id="capabilities-title"
            className={`${sectionTitleClassName} mt-4`}
          >
            Open the run behind the number.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            Every insight answers what changed, where it changed, and which
            executions provide the evidence — then opens those runs. Overview,
            list, and investigation stay one path.
          </p>
        </div>
        <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
          {capabilities.map((group) => (
            <div key={group.title}>
              <h3 className="font-mono text-[11px] tracking-[0.16em] text-primary uppercase">
                {group.title}
              </h3>
              <ul className="mt-6 space-y-6 border-t border-border pt-6">
                {group.items.map((item) => (
                  <li key={item.name}>
                    <p className="text-[15px] font-medium tracking-tight">
                      {item.name}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-7 text-muted-foreground">
                      {item.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
