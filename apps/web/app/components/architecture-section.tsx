import { Button } from "@flowmark/ui"
import { Arrow } from "./brand"
import { docsUrl } from "./site-links"

export function ArchitectureSection() {
  return (
    <section className="architecture-section section-space">
      <div className="shell architecture-grid">
        <div>
          <p className="overline">COMPLEMENTS YOUR OBSERVABILITY STACK</p>
          <h2>
            Review workflow runs
            <br />
            alongside your tools.
          </h2>
          <p className="section-description">
            Flowmark stores the run context, steps, errors, and results you
            explicitly instrument. Use it alongside your existing logs, traces,
            and analytics.
          </p>
          <Button
            asChild
            className="button button-secondary"
            size="lg"
            variant="outline"
          >
            <a href={docsUrl}>
              Explore the integration <Arrow diagonal />
            </a>
          </Button>
        </div>
        <div
          className="lifecycle"
          role="img"
          aria-label="An illustrative workflow lifecycle: application events are sent to the Flowmark API, persisted, and reviewed in a dashboard."
        >
          <div className="lifecycle-row">
            <span className="lifecycle-icon code-icon" aria-hidden="true">
              {"{ }"}
            </span>
            <span>
              <strong>Your application</strong>
              <small>Business logic with SDK markers</small>
            </span>
            <span className="lifecycle-status">YOUR CODE</span>
          </div>
          <div className="lifecycle-link" aria-hidden="true">
            <span className="link-line" />
            <span>context · milestone · outcome</span>
          </div>
          <div className="lifecycle-row">
            <span className="lifecycle-icon api-icon" aria-hidden="true">
              <Arrow />
            </span>
            <span>
              <strong>Flowmark API</strong>
              <small>Validates and stores event records</small>
            </span>
            <span className="lifecycle-status">TELEMETRY</span>
          </div>
          <div className="lifecycle-link" aria-hidden="true">
            <span className="link-line" />
            <span>inspect a recorded run</span>
          </div>
          <div className="lifecycle-row">
            <span className="lifecycle-icon data-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 6.5C4 5.12 7.58 4 12 4s8 1.12 8 2.5S16.42 9 12 9 4 7.88 4 6.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M4 6.5v11C4 18.88 7.58 20 12 20s8-1.12 8-2.5v-11M4 12c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </span>
            <span>
              <strong>Workflow run detail</strong>
              <small>Review the events your code chose to report</small>
            </span>
            <span className="lifecycle-status">CONTEXT</span>
          </div>
        </div>
      </div>
    </section>
  )
}
