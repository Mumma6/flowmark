import { overlineClassName, sectionTitleClassName, shellClassName } from "./shell"

const pillars = [
  {
    mark: "One run",
    title: "Run investigation",
    detail:
      "See what happened in an execution: order, overlapping operations, recovered errors, last-reported progress, the result the application attached, and how this run differs from comparable ones.",
  },
  {
    mark: "Many runs",
    title: "Workflow intelligence",
    detail:
      "See what changed across executions, where it changed, and which runs to open. Volume, duration, failure codes, and reported outcomes open that answer — and lead straight back to the evidence.",
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
            developer marks it once. Anyone in the project can read what it
            reported, then open the execution when that reading is not enough.
          </p>
        </div>
        <div className="mt-12 grid gap-10 border-t border-border pt-10 md:grid-cols-2 md:gap-16">
          {pillars.map((pillar) => (
            <article key={pillar.title}>
              <span className="font-mono text-[10px] tracking-wide text-primary uppercase">
                {pillar.mark}
              </span>
              <h3 className="mt-3 text-xl font-medium tracking-tight sm:text-2xl">
                {pillar.title}
              </h3>
              <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                {pillar.detail}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
