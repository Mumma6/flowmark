import { Badge, Card, CardContent, CardHeader, CardTitle } from "@flowmark/ui"
import { overlineClassName, sectionTitleClassName, shellClassName } from "./shell"

const ahead = [
  {
    title: "What changed, and where",
    detail:
      "A slower p95 names the operations that slowed. A falling success rate names the failure codes that account for it. The next run to open is part of the answer.",
  },
  {
    title: "Reported outcomes over time",
    detail:
      "Follow imported, skipped, or rejected counts across executions, not only on one run. Every number stays labeled as application-reported and links back to the runs behind it.",
  },
  {
    title: "Find the execution",
    detail:
      "Ask for runs where a result field, failure code, operation, or release matches. History is not limited to the latest hundred runs.",
  },
  {
    title: "A closer comparison",
    detail:
      "Differences in operation time, order, progress, and reported result — not only overall duration against recent peers.",
  },
  {
    title: "The shape of one run",
    detail:
      "A waterfall of overlapping operations, milestones, and time spent in stages. Only what was recorded. No invented orchestration graph.",
  },
  {
    title: "A signal worth opening",
    detail:
      "Explainable changes in duration, failures, volume, or reported outcomes, with the uncertainty visible. Silence is not a failure.",
  },
] as const

export function DirectionSection() {
  return (
    <section
      id="direction"
      className="border-t border-border py-16 sm:py-24"
      aria-labelledby="direction-title"
    >
      <div className={shellClassName}>
        <div className="max-w-2xl">
          <p className={overlineClassName}>Still ahead</p>
          <h2 id="direction-title" className={`${sectionTitleClassName} mt-4`}>
            The same product, read more carefully.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            This page describes what Flowmark is for, including capabilities
            that are not in the dashboard yet. They stay inside workflow
            observability: explicit evidence, no guessed cause, and no engine
            that takes over the work.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ahead.map((item) => (
            <Card key={item.title} className="border-border bg-card/70">
              <CardHeader className="gap-3">
                <Badge variant="outline" className="w-fit text-muted-foreground">
                  Not built yet
                </Badge>
                <CardTitle className="text-lg font-medium">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] leading-7 text-muted-foreground">
                  {item.detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
