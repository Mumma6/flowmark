import { overlineClassName, shellClassName } from "./shell"

export function ValueSection() {
  return (
    <section
      className="border-y border-border bg-secondary/20 py-12 sm:py-16"
      aria-labelledby="value-title"
    >
      <div
        className={`${shellClassName} grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center md:gap-16`}
      >
        <div>
          <p className={overlineClassName}>Completion ≠ the whole outcome</p>
          <h2
            id="value-title"
            className="mt-4 text-balance text-2xl leading-snug font-medium tracking-tight sm:text-3xl"
          >
            “The job passed.
            <br />
            Why are 12 customers missing?”
          </h2>
        </div>
        <div className="border-l-2 border-primary/40 pl-6">
          <p className="text-sm leading-7 text-muted-foreground">
            A green status tells you the code finished. It doesn’t tell you what
            was imported, skipped, or left behind. Flowmark puts the
            application’s reported result beside the execution that produced it.
          </p>
          <p className="mt-3 text-sm font-medium">
            Less reconstruction. A clearer conversation.
          </p>
        </div>
      </div>
    </section>
  )
}
