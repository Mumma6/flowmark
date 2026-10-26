import { Card, CardContent } from "@flowmark/ui"
import { overlineClassName, sectionTitleClassName, shellClassName } from "./shell"

const steps = [
  {
    index: "01 / Reported result",
    title: "Read what the run accomplished",
    evidence: (
      <>
        <strong className="font-medium text-primary">850 imported</strong>
        <span>150 skipped</span>
      </>
    ),
    copy: "A completed import can still leave records behind. The result is what the application reported, not an audit that every record succeeded.",
  },
  {
    index: "02 / Run context",
    title: "Start from a reference you chose",
    evidence: <code>batchId: batch_2049</code>,
    copy: "An order, batch, or job id in the run context is how someone finds that execution without reconstructing logs.",
  },
  {
    index: "03 / The execution",
    title: "Open the run when the summary is not enough",
    evidence: <span>Same investigation. No second product.</span>,
    copy: "Product, support, and engineering read the same project. The timeline, operations, and errors are there when the reported result needs a story.",
  },
] as const

export function ValueSection() {
  return (
    <section
      className="border-t border-border py-16 sm:py-[6.25rem]"
      aria-labelledby="value-title"
    >
      <div className={shellClassName}>
        <div className="max-w-[800px]">
          <p className={overlineClassName}>From a result to the execution</p>
          <h2 id="value-title" className={`${sectionTitleClassName} mt-4`}>
            See what the process reported, then open the run.
          </h2>
          <p className="mt-4 max-w-[650px] text-sm leading-7 text-muted-foreground">
            Someone says yesterday&apos;s import created 850 of 1,000 expected
            records. The path is the reported outcome, the reference the
            application attached, and the execution behind them.
          </p>
        </div>
        <ol className="mt-10 grid gap-6 border-t border-border pt-6 sm:grid-cols-3 sm:gap-8">
          {steps.map((step) => (
            <li key={step.title}>
              <span className="font-mono text-[11px] tracking-wide text-primary">
                {step.index}
              </span>
              <h3 className="mt-4 text-[17px] font-medium tracking-tight">
                {step.title}
              </h3>
              <Card className="mt-4 rounded-lg border-border bg-primary/[0.02]">
                <CardContent className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5 font-mono text-xs text-[#dce8d8]">
                  {step.evidence}
                </CardContent>
              </Card>
              <p className="mt-2.5 text-[13px] leading-7 text-muted-foreground">
                {step.copy}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-7 text-xs leading-7 text-muted-foreground">
          A run can already carry that context and result. Finding the
          execution from the reference, and reading the skip without raw JSON,
          is part of what is still ahead. Flowmark does not fix the import.
          The application does.
        </p>
      </div>
    </section>
  )
}
