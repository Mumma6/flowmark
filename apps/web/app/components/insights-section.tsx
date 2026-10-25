import { Card, CardContent, CardHeader, CardTitle } from "@flowmark/ui"
import { overlineClassName, sectionTitleClassName, shellClassName } from "./layout"

const insights = [
  {
    title: "Volume",
    metric: "How often it runs",
    detail:
      "Daily volume for 30 days, plus last week versus the week before.",
  },
  {
    title: "Outcomes",
    metric: "Success rate and failure codes",
    detail:
      "Completed versus failed, and which fail({ code }) values show up most.",
  },
  {
    title: "Performance",
    metric: "Median and p95 duration",
    detail:
      "Typical time to done or fail, and how long the slower runs take.",
  },
  {
    title: "Operations",
    metric: "Which step was slow",
    detail:
      "Named operations ranked by total time, with their own median and p95.",
  },
  {
    title: "Progress",
    metric: "How far it got",
    detail:
      "Last reported snapshot on a long job — 600 of 1,000 records — plus the result.",
  },
  {
    title: "Compare",
    metric: "This run versus the last 20",
    detail:
      "See whether a checkout was slower than usual, and by how much.",
  },
] as const

export function InsightsSection() {
  return (
    <section
      id="insights"
      className="border-t border-border py-16 sm:py-24"
      aria-labelledby="insights-title"
    >
      <div className={shellClassName}>
        <div className="max-w-2xl">
          <p className={overlineClassName}>Data-driven insight</p>
          <h2 id="insights-title" className={`${sectionTitleClassName} mt-4`}>
            Numbers operations can act on.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            Every marked process becomes volume, duration, success rate, and a
            reported result. Open one run when the numbers need a story.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight) => (
            <Card key={insight.title} className="border-border bg-card/70">
              <CardHeader className="gap-2">
                <span className="font-mono text-[10px] tracking-wide text-primary uppercase">
                  {insight.title}
                </span>
                <CardTitle className="text-lg font-medium">
                  {insight.metric}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] leading-7 text-muted-foreground">
                  {insight.detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
