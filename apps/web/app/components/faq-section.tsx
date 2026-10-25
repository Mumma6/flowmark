import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@flowmark/ui"

export function FaqSection() {
  return (
    <section
      className="shell faq-section section-space"
      aria-labelledby="faq-title"
    >
      <div>
        <p className="overline">PRODUCT BOUNDARIES</p>
        <h2 id="faq-title">Questions, answered.</h2>
      </div>
      <Accordion className="faq-list" multiple>
        <AccordionItem value="logging">
          <AccordionTrigger>Is this another logging tool?</AccordionTrigger>
          <AccordionContent>
            <p>
              Flowmark is organized around named processes and individual runs,
              not a stream of log messages. For an invoice import, for example,
              you can review its milestones, operation durations, progress,
              errors and reported result in one timeline, then compare run
              counts, success rates and median duration. It does not collect all
              your application logs.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="cloud-logs">
          <AccordionTrigger>
            How does it fit with my cloud provider&apos;s logs and metrics?
          </AccordionTrigger>
          <AccordionContent>
            <p>
              Keep them. Infrastructure metrics help explain resource usage and
              service health; logs capture technical details. Flowmark adds the
              application process you explicitly name: which import ran, which
              milestones it reached, how its operations performed and what it
              produced. A healthy HTTP endpoint does not, by itself, describe
              the outcome of an entire import.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="logger">
          <AccordionTrigger>
            Can I keep my existing logger or event logger?
          </AccordionTrigger>
          <AccordionContent>
            <p>
              Yes. Continue writing diagnostic messages with your logger and add
              Flowmark markers where you need run-level context. Include the
              same application-defined identifier, such as an import ID, in your
              logs and Flowmark properties to help investigate both. There is no
              automatic log forwarding or cross-tool linking.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="existing-observability">
          <AccordionTrigger>
            What if I already use Axiom, Better Stack or Datadog?
          </AccordionTrigger>
          <AccordionContent>
            <p>
              Those platforms can already support powerful observability
              workflows. Flowmark offers a focused model and interface for
              tracking the processes you instrument, rather than replacing your
              existing stack. If your current dashboards already give you that
              run-level view, you may not need another tool. Flowmark does not
              currently provide native integrations with these platforms.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="product-analytics">
          <AccordionTrigger>
            How is this different from product analytics such as PostHog?
          </AccordionTrigger>
          <AccordionContent>
            <p>
              Product analytics commonly examines user behavior, adoption and
              conversion across events. Flowmark focuses on a specific
              execution: its operations, progress, errors and result, whether
              triggered by a person or a background job. The same action can be
              useful to both. There is overlap, but the primary unit of
              investigation here is a workflow run.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="structured-logs">
          <AccordionTrigger>
            Could I build this with structured logs myself?
          </AccordionTrigger>
          <AccordionContent>
            <p>
              Yes. Structured logs, shared identifiers and custom queries can
              represent much of the same information. Flowmark packages the SDK
              conventions, event validation, persistence, workflow summaries and
              run timeline together so you do not have to maintain that view
              yourself. The distinction is the focused developer experience, not
              exclusive access to the data.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="workflow-framework">
          <AccordionTrigger>
            Do I need a workflow framework or a multi-step process?
          </AccordionTrigger>
          <AccordionContent>
            <p>
              No. Track a form submission, payment, import or background job in
              ordinary application code. A workflow is simply the process you
              choose to follow; it can be short or contain many operations.
              Flowmark does not automatically discover your processes.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="workflow-engine">
          <AccordionTrigger>Is Flowmark a workflow engine?</AccordionTrigger>
          <AccordionContent>
            <p>
              Flowmark records workflows your application runs. It does not
              schedule or execute them. You choose a process and add SDK markers
              in your code; Flowmark records the context, steps, errors, and
              outcomes you report.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="error-recovery">
          <AccordionTrigger>
            Does Flowmark decide whether an error is recovered?
          </AccordionTrigger>
          <AccordionContent>
            <p>
              No. Your code decides whether to handle an error and whether a
              workflow ultimately succeeded. Record recoverable errors with{" "}
              <code>error({"{ handled: true }"})</code>, and terminal outcomes
              with <code>done()</code> or <code>fail()</code>.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="browser">
          <AccordionTrigger>Can I instrument browser code?</AccordionTrigger>
          <AccordionContent>
            <p>
              Yes. The <code>@flowmark/node/browser</code> entry point supports
              public browser keys with allowed origins or a same-origin server
              proxy. Never put a secret server key in frontend code. Browser
              events are untrusted telemetry, not proof of a business result.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  )
}
