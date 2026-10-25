import { CodeShowcase } from "./code-showcase"
import { docsUrl } from "./site-links"

export function InstrumentationSection() {
  return (
    <section
      id="how-it-works"
      className="how-section section-space"
      aria-labelledby="how-title"
    >
      <div className="shell">
        <div className="section-heading">
          <div>
            <p className="overline">A LITTLE CODE. A CLEARER ANSWER.</p>
            <h2 id="how-title">Keep the logic. See the outcome.</h2>
          </div>
          <p>
            Start a run, mark what matters, report the result. Your functions
            stay your functions—no job runner, workflow rewrite, or custom
            dashboard to build.
          </p>
        </div>
        <CodeShowcase />
        <p className="instrumentation-setup">
          One shared server client:{" "}
          <code>const flowmark = createFlowmark()</code>. Business helpers
          belong to your app.{" "}
          <a href={docsUrl}>SDK setup and framework guides →</a>
        </p>
      </div>
    </section>
  )
}
