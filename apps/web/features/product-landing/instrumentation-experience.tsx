import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  FlowmarkMark,
} from "@flowmark/ui"
import { Arrow } from "../../app/components/brand"
import { docsUrl } from "../../app/components/site-links"
import { WorkflowCodeBlock } from "../../app/components/workflow-code-block"
import { bookingCode } from "./instrumentation-example"

const signals = [
  {
    id: "context",
    number: "01",
    title: "Context that connects",
    value: "Cedar Health / Orbit",
    detail:
      "Customer and integration travel with the run. The referral reference connects separate executions in the same process.",
    evidence: 'correlationId: "SYN-REF-2049"',
  },
  {
    id: "outcome",
    number: "02",
    title: "Business meaning, reported",
    value: "Submitted · accepted: true",
    detail:
      "The application reports what the submission returned. Technical completion and reported business results remain distinct.",
    evidence: 'outcome: "submitted", result: { accepted: true }',
  },
  {
    id: "confirmation",
    number: "03",
    title: "What still needs evidence",
    value: "Confirmation not recorded",
    detail:
      "A separate confirmation is expected within 20 minutes. Completing the run does not fulfill it. At this snapshot no confirmation is recorded; that does not prove provider failure.",
    evidence: 'booking.confirmed · within: "20m"',
  },
] as const

export function InstrumentationExperience() {
  return (
    <div className="border-t border-border pt-10 sm:pt-12">
      <div className="mb-7 grid gap-4 lg:grid-cols-2 lg:items-end lg:gap-16">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
            The SDK / Small signals. Shared understanding.
          </p>
          <h3 className="mt-4 max-w-md text-3xl leading-tight font-medium tracking-[-0.04em] sm:text-4xl">
            Give your code a business vocabulary.
          </h3>
        </div>
        <p className="max-w-md text-sm leading-7 text-muted-foreground">
          A customer. An integration. A reported result. Mark what matters where
          the work happens, and make it understandable across your organization.
        </p>
      </div>
      <figure className="overflow-hidden rounded-xl border border-primary/20 bg-card shadow-[0_24px_70px_-35px_#000]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <span className="font-mono text-[10px] text-muted-foreground">
            Your application
            <span aria-hidden="true" className="mx-3 text-primary">
              →
            </span>
            Shared process intelligence
          </span>
          <span className="text-[10px] text-muted-foreground">
            TypeScript SDK
          </span>
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="min-w-0 border-b border-border bg-background/60 p-3 sm:p-5 lg:border-r lg:border-b-0">
            <WorkflowCodeBlock
              title="app/book-appointment.ts"
              value={bookingCode}
            />
          </div>
          <div className="relative isolate min-w-0 p-5 sm:p-7">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_90%_0%,#b9f59712,transparent_70%)]"
            />
            <div className="flex items-center gap-2 text-xs">
              <FlowmarkMark className="size-4 text-primary" />
              What your team can understand
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-[10px]">
              <span className="rounded border border-border bg-background px-2.5 py-2 text-muted-foreground">
                referral.ingest
              </span>
              <span aria-hidden="true" className="h-px w-5 bg-primary/40" />
              <span className="rounded border border-primary/25 bg-primary/5 px-2.5 py-2 text-primary">
                appointment.book
              </span>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Shared reference · SYN-REF-2049
            </p>
            <Accordion defaultValue={["context"]} className="mt-6">
              {signals.map((signal) => (
                <AccordionItem key={signal.id} value={signal.id}>
                  <AccordionTrigger className="gap-3 py-5 hover:no-underline">
                    <span className="self-start pt-1 font-mono text-[9px] text-primary">
                      {signal.number}
                    </span>
                    <span className="grid min-w-0 flex-1 gap-2 text-left">
                      <span className="text-[11px] text-muted-foreground">
                        {signal.title}
                      </span>
                      <span
                        className={`text-sm font-medium ${signal.id === "confirmation" ? "text-warning" : "text-foreground"}`}
                      >
                        {signal.value}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs leading-7 text-muted-foreground">
                      {signal.detail}
                    </p>
                    <code className="mt-3 block break-words rounded border border-border bg-background/70 p-3 text-[10px] leading-6 text-foreground/80">
                      {signal.evidence}
                    </code>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <p className="mt-5 text-[10px] leading-6 text-muted-foreground">
              The same evidence in Studio, your agent and the tools you build.
            </p>
          </div>
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-[9px] leading-5 text-muted-foreground sm:px-6">
          <span>
            Illustrative application · synthetic Meridian Health context
          </span>
          <span>Snapshot · 24 Oct, 11:00 UTC</span>
        </figcaption>
      </figure>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <code className="text-xs">
          <span aria-hidden="true" className="mr-3 text-primary">
            $
          </span>
          npm i @flowmarkdev/node
        </code>
        <Button asChild variant="link" className="h-11 px-0 text-xs">
          <a href={docsUrl}>
            Build with the SDK <Arrow />
          </a>
        </Button>
      </div>
      <p className="mt-2 max-w-2xl text-[10px] leading-6 text-muted-foreground">
        Uses a configured client. Your application submits the booking and
        stores the confirmation reference; Flowmark records the evidence. Flush
        at your process boundary or use the Next.js lifecycle adapter.
      </p>
    </div>
  )
}
