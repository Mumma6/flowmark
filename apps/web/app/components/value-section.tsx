export function ValueSection() {
  return (
    <section
      className="value-section section-space"
      aria-labelledby="value-title"
    >
      <div className="shell">
        <div className="section-intro">
          <p className="overline">FROM A RUN TO A NEXT STEP</p>
          <h2 id="value-title">12 invoices skipped. Now what?</h2>
          <p>
            Find the affected batch, check why it happened, and fix what was
            missed—not the 988 invoices already imported.
          </p>
        </div>
        <ol className="value-grid">
          <li>
            <span className="value-index">01 / IN FLOWMARK</span>
            <h3>Spot the incomplete import</h3>
            <div className="action-evidence">
              <strong>988 imported</strong>
              <span>12 skipped</span>
            </div>
            <p>
              “Completed” is not the same as “everything imported.” Open the run
              that needs attention.
            </p>
          </li>
          <li>
            <span className="value-index">02 / IN YOUR LOGS</span>
            <h3>Find the rejected records</h3>
            <div className="action-evidence">
              <code>batchId: batch_2049</code>
            </div>
            <p>
              Use the batch ID recorded on the run to look up rejection details
              in your importer’s logs.
            </p>
          </li>
          <li>
            <span className="value-index">03 / IN YOUR APP</span>
            <h3>Correct, then reprocess</h3>
            <div className="action-evidence">
              <span>12 records to investigate—not 1,000</span>
            </div>
            <p>
              Fix the rejected data. If your importer supports selective
              retries, reprocess those records and check the new run.
            </p>
          </li>
        </ol>
        <p className="action-boundary">
          Flowmark gives you the run and its reported result. Your logs explain
          the rejection; your application handles the fix.
        </p>
      </div>
    </section>
  )
}
