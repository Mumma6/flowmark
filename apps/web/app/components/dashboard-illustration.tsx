import { Card } from "@flowmark/ui"
import { Mark } from "./brand"

const results = [
  { label: "Processed", value: "5", detail: "invoices" },
  { label: "Imported", value: "3", detail: "saved by the app" },
  { label: "Skipped", value: "2", detail: "validation issues" },
  { label: "Handled", value: "2", detail: "recorded errors" },
]

const timeline = [
  { event: "source-loaded", kind: "start", status: "5 invoices" },
  { event: "invoice-skipped", kind: "error", status: "2 handled" },
  { event: "save-valid-invoices", kind: "operation", status: "measured" },
  { event: "import-finished", kind: "done", status: "Partial" },
]

export function DashboardIllustration() {
  return (
    <Card
      className="dashboard-frame"
      role="group"
      aria-label="Illustrative Flowmark dashboard"
    >
      <div className="dashboard-topbar">
        <div className="dashboard-brand">
          <span className="dashboard-mark" aria-hidden="true">
            <Mark />
          </span>
          <span>Flowmark</span>
          <span className="dashboard-divider" aria-hidden="true" />
          <span className="dashboard-project">Run investigation</span>
        </div>
        <span className="illustration-label">ILLUSTRATIVE RUN</span>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-heading">
          <div>
            <p className="overline">ONE RUN · REPORTED OUTCOME</p>
            <h2>Invoice import</h2>
          </div>
          <span className="period-chip partial-chip">
            <span className="status-dot" />
            Completed · partial
          </span>
        </div>

        <div className="metric-grid" aria-label="Application-reported result">
          {results.map((result) => (
            <article className="metric-card" key={result.label}>
              <span>{result.label}</span>
              <strong>{result.value}</strong>
              <small>{result.detail}</small>
            </article>
          ))}
        </div>

        <div className="dashboard-lower">
          <section className="activity-card" aria-labelledby="outcome-title">
            <div className="card-heading">
              <div>
                <h3 id="outcome-title">What happened</h3>
                <p>Evidence in this run</p>
              </div>
              <span className="sample-workflow">batch · sample-001</span>
            </div>
            <div className="outcome-breakdown">
              <div className="outcome-row">
                <span
                  className="outcome-icon outcome-imported"
                  aria-hidden="true"
                >
                  +
                </span>
                <span>
                  <strong>3 invoices imported</strong>
                  <small>Valid records saved by the application</small>
                </span>
              </div>
              <div className="outcome-row">
                <span
                  className="outcome-icon outcome-skipped"
                  aria-hidden="true"
                >
                  !
                </span>
                <span>
                  <strong>2 invoices skipped</strong>
                  <small>Validation errors were recorded as handled</small>
                </span>
              </div>
              <div className="reported-note">
                <span className="status-dot" />
                Reported by your application—not independently verified
              </div>
            </div>
          </section>

          <section className="timeline-card" aria-labelledby="timeline-title">
            <div className="card-heading">
              <div>
                <h3 id="timeline-title">Run timeline</h3>
                <p>Steps, errors, operation, outcome</p>
              </div>
              <span className="sample-workflow">invoice.import</span>
            </div>
            <ol className="event-list">
              {timeline.map((item) => (
                <li className={`event-${item.kind}`} key={item.event}>
                  <span className="event-marker" aria-hidden="true" />
                  <span className="event-name">{item.event}</span>
                  <span className="event-status">{item.status}</span>
                </li>
              ))}
            </ol>
            <p className="illustration-note">
              Static illustration · synthetic example data
            </p>
          </section>
        </div>
      </div>
    </Card>
  )
}
