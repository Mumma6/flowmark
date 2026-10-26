import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@flowmark/ui"
import { overlineClassName, sectionTitleClassName, shellClassName } from "./shell"

const surfaces = [
  {
    title: "Run investigation",
    detail:
      "What happened in this execution: order, operation time, recovered errors, last reported progress, the result the application attached, and how this run compares with recent ones.",
    mark: "One run",
  },
  {
    title: "Workflow intelligence",
    detail:
      "What changed across executions, where it changed, and which runs to open. Volume and duration open that answer. So does what those runs reported accomplishing.",
    mark: "Many runs",
  },
  {
    title: "A small write API",
    detail:
      "workflow, step, operation, progress, error, and a reported result. Ordinary TypeScript and Promises. The application keeps the process.",
    mark: "SDK",
  },
] as const

export function ProductSection() {
  return (
    <section
      id="product"
      className="border-t border-border py-16 sm:py-24"
      aria-labelledby="product-title"
    >
      <div className={shellClassName}>
        <div className="max-w-2xl">
          <p className={overlineClassName}>The product</p>
          <h2 id="product-title" className={`${sectionTitleClassName} mt-4`}>
            From one execution to the pattern across them.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            Flowmark observes a process the application already owns. A
            developer marks it. Anyone in the project can read what it
            reported, then open the execution when that reading is not enough.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {surfaces.map((surface) => (
            <Card key={surface.title} className="border-border bg-card/70">
              <CardHeader className="gap-3">
                <span className="w-fit rounded-md border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-[10px] tracking-wide text-primary">
                  {surface.mark}
                </span>
                <CardTitle className="text-lg font-medium">
                  {surface.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-[13px] leading-7">
                  {surface.detail}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
