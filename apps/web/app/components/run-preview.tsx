import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Card,
} from "@flowmark/ui"
import type { RunPreviewData } from "./code-examples"

export function RunPreview({ preview }: { preview: RunPreviewData }) {
  return (
    <section
      className="scenario-result"
      aria-label={`${preview.name} run walkthrough`}
    >
      <div className="scenario-column-heading">
        <span className="overline">WHAT YOU SEE IN FLOWMARK</span>
        <span>{preview.duration}</span>
      </div>
      <Card
        className={`run-preview run-preview-${preview.status.toLowerCase()}`}
      >
        <div className="run-preview-heading">
          <code>{preview.name}</code>
          <span
            className={`run-preview-status run-preview-status-${preview.status === "Failed" ? "failed" : "complete"}`}
          >
            <i aria-hidden="true" />
            {preview.status}
          </span>
        </div>
        <h4 className="run-outcome-headline">{preview.headline}</h4>
        <p className="run-outcome-explanation">{preview.explanation}</p>
        <dl className="run-outcome-metrics">
          {preview.metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
        <div className="run-evidence-heading">
          <strong>Follow the evidence</strong>
          <span>Select an event to inspect it</span>
        </div>
        <Accordion
          key={preview.name}
          defaultValue={preview.events.slice(-1).map(({ id }) => id)}
          className="run-evidence"
        >
          {preview.events.map((event) => (
            <AccordionItem
              value={event.id}
              key={event.id}
              className={`run-evidence-item run-evidence-${event.kind}`}
            >
              <AccordionTrigger>
                <span className="run-event-marker" aria-hidden="true" />
                <span className="run-event-copy">
                  <strong>{event.title}</strong>
                  <small>{event.summary}</small>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p>{event.detail}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </section>
  )
}
