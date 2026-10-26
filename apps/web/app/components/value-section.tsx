import { Card, CardContent } from "@flowmark/ui"
import { overlineClassName, sectionTitleClassName, shellClassName } from "./shell"

const steps = [
  {
    index: "01 / In Flowmark",
    title: "See the incomplete outcome",
    evidence: (
      <>
        <strong className="font-medium text-primary">988 succeeded</strong>
        <span>12 failed</span>
      </>
    ),
    copy: "A completed job can still leave skipped work. Open the process and read the reported result.",
  },
  {
    index: "02 / In your tools",
    title: "Follow the business id",
    evidence: <code>orderId: ord_2049</code>,
    copy: "Use the identifier you attached — an order, a source, a job — to look up the rest in logs and systems you already have.",
  },
  {
    index: "03 / In the process",
    title: "Close the gap",
    evidence: <span>12 items to investigate—not 1,000</span>,
    copy: "Fix what failed. If the process can retry a subset, do that and check the new outcome.",
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
          <p className={overlineClassName}>From insight to a next step</p>
          <h2 id="value-title" className={`${sectionTitleClassName} mt-4`}>
            See what operations actually produced.
          </h2>
          <p className="mt-4 max-w-[650px] text-sm leading-7 text-muted-foreground">
            Start from success rate and duration. Open the process that needs
            attention, read what it reported, and fix the gap.
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
          Flowmark gives operations the reported result. Your application
          handles the fix.
        </p>
      </div>
    </section>
  )
}
