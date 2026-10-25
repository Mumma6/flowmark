import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@flowmark/ui"
import { overlineClassName, sectionTitleClassName, shellClassName } from "./layout"

const surfaces = [
  {
    title: "TypeScript SDK",
    detail:
      "A few markers around the business logic you already have. Ordinary methods and Promises. This is how the data reaches Flowmark.",
    mark: "SDK",
  },
  {
    title: "Flowmark API",
    detail:
      "Validates and stores what the application reports: context, operations, progress, errors, and the business result.",
    mark: "API",
  },
  {
    title: "Operations dashboard",
    detail:
      "Open a process and understand what it produced — the timeline, the gaps, and the reported outcome. No custom queries to write.",
    mark: "UI",
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
            Insight from the business logic you already have.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            Developers mark a process. Operations opens it and understands
            what it accomplished.
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
