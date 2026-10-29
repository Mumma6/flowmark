import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Card,
  CardContent,
} from "@flowmark/ui"
import type { RunPreviewData } from "./code-examples"
import { overlineClassName } from "./shell"

const markerClassName = {
  step: "border-muted-foreground",
  done: "border-success bg-success",
  error: "border-destructive bg-destructive",
} as const

export function RunPreview({ preview }: { preview: RunPreviewData }) {
  const failed = preview.status === "Failed"

  return (
    <section
      className="min-w-0 w-full"
      aria-label={`${preview.name} run walkthrough`}
    >
      <div className="mb-3 flex min-h-8 flex-wrap items-baseline justify-between gap-2">
        <span className={overlineClassName}>What you see in Flowmark</span>
        <span className="text-[11px] text-muted-foreground">
          {preview.duration}
        </span>
      </div>
      <Card className="rounded-xl border-border bg-card shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <code className="font-mono text-xs text-muted-foreground">
              {preview.name}
            </code>
            <Badge variant={failed ? "destructive" : "success"}>
              <span
                className={`size-1.5 rounded-full ${failed ? "bg-destructive" : "bg-success"}`}
                aria-hidden="true"
              />
              {preview.status}
            </Badge>
          </div>
          <h4 className="mt-6 mb-2.5 text-[clamp(1.375rem,2.1vw,1.75rem)] font-medium tracking-tight text-foreground">
            {preview.headline}
          </h4>
          <p className="text-[13px] leading-7 text-muted-foreground">
            {preview.explanation}
          </p>
          <dl className="my-6 grid grid-cols-3 gap-2 border-y border-border py-4 sm:gap-3">
            {preview.metrics.map((metric) => (
              <div key={metric.label}>
                <dt className="min-h-7 text-[10px] text-muted-foreground">
                  {metric.label}
                </dt>
                <dd className="mt-1.5 text-base tracking-tight text-foreground sm:text-lg">
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mb-3 grid gap-1">
            <strong className="text-[13px] font-medium">
              Follow the evidence
            </strong>
            <span className="text-[11px] text-muted-foreground">
              Select an event to inspect it
            </span>
          </div>
          <Accordion
            key={preview.name}
            defaultValue={preview.events.slice(-1).map(({ id }) => id)}
          >
            {preview.events.map((event) => (
              <AccordionItem value={event.id} key={event.id}>
                <AccordionTrigger className="min-w-0 gap-3 py-4">
                  <span
                    className={`size-2 shrink-0 rounded-full border ${markerClassName[event.kind]}`}
                    aria-hidden="true"
                  />
                  <span className="grid min-w-0 flex-1 gap-1 text-left">
                    <strong className="text-[13px] font-medium text-foreground">
                      {event.title}
                    </strong>
                    <small className="break-words text-[11px] text-muted-foreground">
                      {event.summary}
                    </small>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="ml-5 text-xs leading-7 text-muted-foreground">
                    {event.detail}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </section>
  )
}
