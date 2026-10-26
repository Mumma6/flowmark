import { overlineClassName, sectionTitleClassName, shellClassName } from "./shell"

const steps = [
  {
    index: "01",
    title: "Read what the run accomplished",
    evidence: (
      <>
        <strong className="font-medium text-primary">850 imported</strong>
        <span>150 skipped</span>
      </>
    ),
    copy: "A completed import can still leave records behind. The result is what the application reported — visible without reconstructing logs.",
  },
  {
    index: "02",
    title: "Start from a reference you chose",
    evidence: <code>batchId: batch_2049</code>,
    copy: "An order, batch, or job id in the run context is how someone finds that execution when a customer asks what happened.",
  },
  {
    index: "03",
    title: "Open the run when the summary is not enough",
    evidence: <span>Same investigation. No second product.</span>,
    copy: "Product, support, and engineering read the same project. The timeline, operations, and errors are there when the reported result needs a story.",
  },
] as const

export function ValueSection() {
  return (
    <section
      id="outcomes"
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
            application attached, and the execution behind them — without
            waiting for an engineer to translate the logs.
          </p>
        </div>
        <ol className="mt-10 grid gap-8 border-t border-border pt-8 sm:grid-cols-3 sm:gap-10">
          {steps.map((step) => (
            <li key={step.title}>
              <span className="font-mono text-[11px] tracking-wide text-primary">
                {step.index}
              </span>
              <h3 className="mt-4 text-[17px] font-medium tracking-tight">
                {step.title}
              </h3>
              <div className="mt-4 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-primary/[0.02] p-3.5 font-mono text-xs text-[#dce8d8]">
                {step.evidence}
              </div>
              <p className="mt-3 text-[13px] leading-7 text-muted-foreground">
                {step.copy}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
