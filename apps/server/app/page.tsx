import styles from "./reference.module.css"

type Endpoint = {
  id: string
  method: "GET" | "POST" | "OPTIONS"
  path: string
  title: string
  auth: string
  description: string
  request: string
  response: string
  codes: [string, string][]
  notes?: string
}

const eventExample = JSON.stringify(
  {
    eventId: "11111111-1111-4111-8111-111111111111",
    event: {
      type: "started",
      workflow: "checkout",
      runId: "checkout-example-001",
      timestamp: "2026-01-01T12:00:00.000Z",
      properties: { source: "reference-example" },
      correlationId: "checkout-request-123",
      parentRunId: "browser-run-id-from-application-propagation",
    },
  },
  null,
  2,
)

const ingestionCodes: [string, string][] = [
  ["202", 'Persisted, or duplicate event ID ignored. {"accepted":true}'],
  ["400", "Invalid JSON, invalid event envelope, or body over 64 KiB."],
  ["401", "Missing, invalid, or wrong-purpose Bearer key."],
  ["409", "Send the started event before other run events."],
  ["503", "Configuration or event storage unavailable."],
]

const queryCodes: [string, string][] = [
  ["200", "Query result in a tRPC result.data envelope."],
  ["401", "Invalid dashboard read key (UNAUTHORIZED)."],
  ["500", "Configuration or database read failed (INTERNAL_SERVER_ERROR)."],
]

const snapshotSchema = `{
  runs: Array<{
    id: UUID, externalId: string, workflow: string, startedAt: string,
    status: "Completed" | "Failed" | "Running",
    durationMs: number | null, step: string | null,
    correlationId: string | null, parentRunId: string | null
  }>,
  workflows: Array<{
    name: string, runs: number, successRate: number | null,
    medianDurationMs: number, p95DurationMs: number
  }>,
  metrics: {
    totalRuns: number, failedRuns: number,
    successRate: number | null, medianDurationMs: number, p95DurationMs: number
  },
  daily: Array<{
    date: string, count: number, completed: number, failed: number,
    successRate: number | null, medianDurationMs: number | null,
    p95DurationMs: number | null
  }>,
  operations: Array<{
    name: string, workflow: string, count: number, failed: number,
    medianDurationMs: number, p95DurationMs: number, totalDurationMs: number
  }>,
  failureCodes: Array<{ code: string, workflow: string, count: number }>
}`

const endpoints: Endpoint[] = [
  {
    id: "health",
    method: "GET",
    path: "/api/health",
    title: "Check API liveness",
    auth: "No key",
    description:
      "A database-independent liveness check. This confirms the HTTP service responds, not that PostgreSQL or ingestion is ready.",
    request: 'curl "$FLOWMARK_API_URL/api/health"',
    response: '{"status":"ok","service":"flowmark-api"}',
    codes: [["200", "The API HTTP service is alive."]],
  },
  {
    id: "private-events",
    method: "POST",
    path: "/v1/events",
    title: "Ingest a server workflow event",
    auth: "Private write key",
    description:
      "Accepts one event envelope, resolves the project from the key, and acknowledges only after persistence. Server-side only: no browser CORS handler is provided here.",
    request: `curl "$FLOWMARK_API_URL/v1/events" \\
  -H "Authorization: Bearer $FLOWMARK_WRITE_KEY" \\
  -H "Content-Type: application/json" \\
  --data '${eventExample}'`,
    response: '{"accepted":true}',
    codes: ingestionCodes,
    notes:
      "Keep write keys on a trusted server. Never put them in NEXT_PUBLIC_* variables, browser bundles, screenshots, or client-side requests. Reuse the same eventId when retrying the same event.",
  },
  {
    id: "browser-events",
    method: "POST",
    path: "/v1/browser-events",
    title: "Ingest an untrusted browser event",
    auth: "Public browser key + Origin",
    description:
      "Uses a separate browser credential with an exact origin allowlist. Workflow names are prefixed with browser. unless already prefixed. Browser telemetry is not trusted server evidence.",
    request: `// Run only from an origin configured for YOUR public browser key.
// Explicit example: this writes an event when you execute it.
await fetch("http://localhost:3003/v1/browser-events", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer YOUR_PUBLIC_BROWSER_KEY",
  },
  body: JSON.stringify(${eventExample}),
});`,
    response: '{"accepted":true}',
    codes: [
      ...ingestionCodes.slice(0, 3),
      ["403", "Missing Origin, or origin not allowed for this browser key."],
      ["409", "Send the started event before other run events."],
      ["429", "120 events/minute/key exceeded; Retry-After: 60."],
      ingestionCodes[4]!,
    ],
    notes:
      "The browser sets Origin; JavaScript cannot choose it. Public keys cannot query data or use private ingestion. CORS is a browser restriction, not proof of caller identity: a non-browser client can forge Origin. The shared key quota is consumed before payload validation. Auth/origin failures and unavailable-storage responses do not include CORS headers.",
  },
  {
    id: "browser-options",
    method: "OPTIONS",
    path: "/v1/browser-events",
    title: "Negotiate browser ingestion CORS",
    auth: "Allowed Origin",
    description:
      "Preflight checks whether any configured browser key allows the origin and the requested method is POST. It does not authenticate a key; the subsequent POST checks that key’s own allowlist.",
    request: `curl -i -X OPTIONS "$FLOWMARK_API_URL/v1/browser-events" \\
  -H "Origin: http://localhost:3004" \\
  -H "Access-Control-Request-Method: POST" \\
  -H "Access-Control-Request-Headers: content-type, authorization"`,
    response: `HTTP 204 (empty body)
Access-Control-Allow-Origin: <allowed request origin>
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: content-type, authorization, traceparent, b3
Access-Control-Max-Age: 600
Vary: Origin
Cache-Control: no-store`,
    codes: [
      ["204", "Allowed origin and POST requested."],
      ["403", "Missing/disallowed origin or requested method is not POST."],
      ["503", "Configuration or origin lookup unavailable."],
    ],
  },
  {
    id: "trpc-transport",
    method: "OPTIONS",
    path: "/api/trpc/{procedure}",
    title: "Typed query transport · GET / POST / OPTIONS",
    auth: "Depends on procedure",
    description:
      "The route exports GET, POST, and OPTIONS. All current procedures are queries: use GET. POST is wired to the tRPC adapter, but there are no mutations and query-over-POST is not enabled.",
    request: `curl -i -X OPTIONS "$FLOWMARK_API_URL/api/trpc/project.snapshot" \\
  -H "Origin: http://localhost:3001" \\
  -H "Access-Control-Request-Method: GET"`,
    response: `HTTP 204 (empty body)
// Only when Origin equals FLOWMARK_DASHBOARD_ORIGIN:
Access-Control-Allow-Origin: <configured dashboard origin>
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: content-type, authorization
Vary: Origin`,
    codes: [
      [
        "204",
        "OPTIONS returns no body; unrecognized origins get no CORS grant.",
      ],
      ["400", "Malformed input or invalid run UUID (BAD_REQUEST)."],
      ["404", "Unknown procedure (NOT_FOUND)."],
      [
        "405",
        "Wrong method, including POST to a query (METHOD_NOT_SUPPORTED).",
      ],
      [
        "415",
        "Unsupported or missing POST Content-Type (UNSUPPORTED_MEDIA_TYPE).",
      ],
    ],
    notes:
      "The CORS origin defaults to http://localhost:3001. CORS does not authorize a read; protected procedures still require a read key. Prefer a same-origin server proxy to keep dashboard read keys out of browsers. Standard tRPC batching may return 207 for mixed outcomes.",
  },
  {
    id: "trpc-health",
    method: "GET",
    path: "/api/trpc/health.check",
    title: "Check liveness through tRPC",
    auth: "No key",
    description:
      "The typed equivalent of the HTTP health check. No input, authentication, or database access.",
    request: 'curl "$FLOWMARK_API_URL/api/trpc/health.check"',
    response: '{"result":{"data":{"status":"ok","service":"flowmark-api"}}}',
    codes: [["200", "Service responds with a tRPC result envelope."]],
  },
  {
    id: "project-snapshot",
    method: "GET",
    path: "/api/trpc/project.snapshot",
    title: "Read the project overview",
    auth: "Private read key",
    description:
      "No input. Returns the latest 100 runs, workflow summaries, volume/success/duration metrics, 30-day daily insight, slowest operations, and failure codes. Project scope comes from the read key, never a client-supplied project ID.",
    request: `curl "$FLOWMARK_API_URL/api/trpc/project.snapshot" \\
  -H "Authorization: Bearer $FLOWMARK_READ_KEY"`,
    response: `// Schema of result.data (not a literal JSON response)
${snapshotSchema}`,
    codes: queryCodes,
    notes:
      "Success rate is a percentage across terminal runs and is null when no runs have finished. Keep the read key server-side: it grants access to project workflow data.",
  },
  {
    id: "workflow-list",
    method: "GET",
    path: "/api/trpc/workflow.list",
    title: "List workflow summaries",
    auth: "Private read key",
    description:
      "No input. Returns the workflows portion of the authorized project snapshot, ordered by workflow name.",
    request: `curl "$FLOWMARK_API_URL/api/trpc/workflow.list" \\
  -H "Authorization: Bearer $FLOWMARK_READ_KEY"`,
    response: `// Schema of result.data
Array<{
  name: string,
  runs: number,
  successRate: number | null,
  medianDurationMs: number,
  p95DurationMs: number
}>`,
    codes: queryCodes,
  },
  {
    id: "run-detail",
    method: "GET",
    path: "/api/trpc/run.detail",
    title: "Read a run’s event timeline",
    auth: "Private read key",
    description:
      "Input: { id: UUID }. Use the internal runs[].id from project.snapshot, not the external runId supplied during ingestion. Events are ordered by occurrence time, then insertion time. Error and result values are recorded on their corresponding events.",
    request: `curl --get "$FLOWMARK_API_URL/api/trpc/run.detail" \\
  -H "Authorization: Bearer $FLOWMARK_READ_KEY" \\
  --data-urlencode 'input={"id":"11111111-1111-4111-8111-111111111111"}'`,
    response: `// Schema of result.data
Array<{
  id: UUID,
  type: "started" | "step" | "properties" | "error" | "operation_started" | "operation_completed" | "operation_failed" | "progress" | "completed" | "failed",
  step: string | null, reason: string | null,
  operationId: UUID | null, operationName: string | null,
  durationMs: number | null,
  completed: number | null, total: number | null, unit: string | null,
  error: { code: string, message?: string, retryable?: boolean, handled?: boolean } | null,
  result: Record<string, JsonValue> | null,
  properties: Record<string, JsonValue> | null,
  timestamp: string, receivedAt: string, workflow: string, externalId: string,
  environment: string | null, release: string | null,
  correlationId: string | null, parentRunId: string | null
}>`,
    codes: [
      ...queryCodes,
      ["400", "Missing input or id is not a UUID (BAD_REQUEST)."],
    ],
    notes:
      "An unknown run UUID, or a run belonging to a different project, returns an empty array with HTTP 200, not 404. properties contains each event's own payload; merge started/properties event patches chronologically for run context. receivedAt is when the API persisted that event.",
  },
  {
    id: "run-related",
    method: "GET",
    path: "/api/trpc/run.related",
    title: "Read explicitly linked runs",
    auth: "Private read key",
    description:
      "Input: { id: UUID } using the internal runs[].id from project.snapshot. Returns project-scoped parentMatches for the supplied parentRunId external ID and all other related runs sharing correlationId. It does not limit matches to the latest-100 snapshot.",
    request: `curl --get "$FLOWMARK_API_URL/api/trpc/run.related" \\
  -H "Authorization: ******" \\
  --data-urlencode 'input={"id":"11111111-1111-4111-8111-111111111111"}'`,
    response: `// Schema of result.data
{
  parentMatches: Array<{
    id: UUID, externalId: string, workflow: string, startedAt: string,
    status: "Completed" | "Failed" | "Running",
    correlationId: string | null, parentRunId: string | null
  }>,
  related: Array<{
    id: UUID, externalId: string, workflow: string, startedAt: string,
    status: "Completed" | "Failed" | "Running",
    correlationId: string | null, parentRunId: string | null
  }>
}`,
    codes: [
      ...queryCodes,
      ["400", "Missing input or id is not a UUID (BAD_REQUEST)."],
    ],
    notes:
      "Unknown or cross-project run IDs return empty arrays. Empty parentMatches means no same-project parent run is currently recorded; multiple matches are possible because external IDs are unique within a workflow. Shared correlation IDs group application-declared runs and do not prove causation or create a distributed trace.",
  },
  {
    id: "run-compare",
    method: "GET",
    path: "/api/trpc/run.compare",
    title: "Compare a run to recent peers",
    auth: "Private read key",
    description:
      "Input: { id: UUID }. Returns the current run and the last 20 finished or recorded peers of the same workflow, plus peer success rate, median duration, and p95 duration.",
    request: `curl --get "$FLOWMARK_API_URL/api/trpc/run.compare" \\
  -H "Authorization: Bearer $FLOWMARK_READ_KEY" \\
  --data-urlencode 'input={"id":"11111111-1111-4111-8111-111111111111"}'`,
    response: `// Schema of result.data
{
  current: StoredRun | null,
  peers: StoredRun[],
  peerSuccessRate: number | null,
  peerMedianDurationMs: number | null,
  peerP95DurationMs: number | null
}`,
    codes: [
      ...queryCodes,
      ["400", "Missing input or id is not a UUID (BAD_REQUEST)."],
    ],
  },
]

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  return (
    <details className={styles.endpoint} id={endpoint.id}>
      <summary className={styles.endpointSummary}>
        <span className={`${styles.method} ${styles[endpoint.method]}`}>
          {endpoint.method}
        </span>
        <span className={styles.endpointHeading}>
          <code>{endpoint.path}</code>
          <span>{endpoint.title}</span>
        </span>
        <span className={styles.auth}>{endpoint.auth}</span>
        <span className={styles.chevron} aria-hidden="true">
          +
        </span>
      </summary>
      <div className={styles.endpointBody}>
        <p>{endpoint.description}</p>
        {endpoint.notes && <p className={styles.note}>{endpoint.notes}</p>}
        <div className={styles.examples}>
          <section>
            <h3>Request example</h3>
            <pre>
              <code>{endpoint.request}</code>
            </pre>
          </section>
          <section>
            <h3>Success response / schema</h3>
            <pre>
              <code>{endpoint.response}</code>
            </pre>
          </section>
        </div>
        <h3>Response codes</h3>
        <table>
          <caption className={styles.srOnly}>
            Responses for {endpoint.path}
          </caption>
          <thead>
            <tr>
              <th scope="col">HTTP</th>
              <th scope="col">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {endpoint.codes.map(([code, description]) => (
              <tr key={code}>
                <th scope="row">
                  <code>{code}</code>
                </th>
                <td>{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export default function ApiHome() {
  return (
    <div className={styles.reference}>
      <a className={styles.skipLink} href="#reference">
        Skip to API reference
      </a>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Flowmark API home">
          <span className={styles.brandMark} aria-hidden="true">
            f.
          </span>
          Flowmark <span> / API reference</span>
        </a>
        <nav aria-label="Related resources">
          <a href="http://localhost:3002/docs/api">Documentation ↗</a>
          <a href="http://localhost:3001">Dashboard ↗</a>
        </nav>
      </header>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <p className={styles.eyebrow}>On this page</p>
          <nav aria-label="Reference sections">
            <a href="#overview">Overview</a>
            <a href="#authentication">Authentication</a>
            <a href="#endpoints">Endpoints & queries</a>
            <a href="#event-schema">Event schema</a>
          </nav>
          <p className={styles.eyebrow}>Jump to an operation</p>
          <nav aria-label="Endpoint operations">
            {endpoints.map((endpoint) => (
              <a href={`#${endpoint.id}`} key={endpoint.id}>
                <span className={styles.navDot} data-method={endpoint.method} />
                {endpoint.title.split(" · ")[0]}
              </a>
            ))}
          </nav>
          <div className={styles.sidebarNote}>
            Self-hosted
            <br />
            No hosted API service
          </div>
        </aside>
        <main id="reference" className={styles.main}>
          <section id="overview" className={styles.hero}>
            <p className={styles.eyebrow}>
              Developer reference <span>v1 ingestion · tRPC queries</span>
            </p>
            <h1>
              Your workflows.
              <br />
              <span>One observable timeline.</span>
            </h1>
            <p className={styles.lead}>
              Send explicit workflow events, inspect project activity, and
              follow a run from start to outcome. Everything the current API
              exposes, in one place.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryLink} href="#endpoints">
                Explore endpoints ↓
              </a>
              <a className={styles.healthLink} href="/api/health">
                Open health check ↗
              </a>
            </div>
            <div className={styles.baseUrl}>
              <span>LOCAL BASE URL</span>
              <code>http://localhost:3003</code>
              <span>JSON over HTTP</span>
            </div>
          </section>

          <section className={styles.section} id="authentication">
            <div className={styles.sectionHeading}>
              <span>01</span>
              <h2>Separate keys. Separate trust.</h2>
            </div>
            <p>
              Protected operations use{" "}
              <code>Authorization: Bearer &lt;key&gt;</code>. Keys resolve a
              project and a specific permission; read, server-write, and browser
              keys are not interchangeable. Health checks require no key.
            </p>
            <div className={styles.keyGrid}>
              <article>
                <span className={styles.keyLabel}>SERVER → API</span>
                <h3>Private write key</h3>
                <p>
                  Ingest trusted server events with <code>/v1/events</code>.
                  Never expose this credential in a browser.
                </p>
              </article>
              <article>
                <span className={styles.keyLabel}>SERVER → API</span>
                <h3>Private read key</h3>
                <p>
                  Read project data through tRPC. Keep the key behind a
                  same-origin dashboard proxy.
                </p>
              </article>
              <article>
                <span className={styles.keyLabel}>BROWSER → API</span>
                <h3>Public browser key</h3>
                <p>
                  Write only, exact allowed origins, 120 events/minute/key, and
                  a <code>browser.</code> workflow namespace.
                </p>
              </article>
            </div>
            <p className={styles.note}>
              This page never loads credentials or executes writes. Examples are
              inert until you run them. Replace placeholders with your own
              provisioned keys; no key creation or management endpoint exists
              here. Fixed demo credentials are rejected unless{" "}
              <code>FLOWMARK_DEMO_MODE=true</code>.
            </p>
          </section>

          <section className={styles.section} id="endpoints">
            <div className={styles.sectionHeading}>
              <span>02</span>
              <h2>Endpoints & queries</h2>
            </div>
            <p>
              Expand an operation for its request, response schema, and error
              codes. Examples assume{" "}
              <code>FLOWMARK_API_URL=http://localhost:3003</code> and your own
              server-side key environment variables. Sending an example POST
              persists data.
            </p>
            <div className={styles.legend}>
              <span>GET · read</span>
              <span>POST · ingest</span>
              <span>OPTIONS · preflight</span>
              <span>Keyboard: Tab + Enter to expand</span>
            </div>
            <div className={styles.endpointList}>
              {endpoints.map((endpoint) => (
                <EndpointCard key={endpoint.id} endpoint={endpoint} />
              ))}
            </div>
            <p className={styles.small}>
              tRPC success: <code>{'{"result":{"data":…}}'}</code>. Errors use
              an <code>error</code> envelope containing <code>message</code>, a
              numeric <code>code</code>, and{" "}
              <code>data.code / data.httpStatus / data.path</code>. Batch
              envelopes differ from the single-call examples above.
            </p>
          </section>

          <section className={styles.section} id="event-schema">
            <div className={styles.sectionHeading}>
              <span>03</span>
              <h2>One envelope. Ten event types.</h2>
            </div>
            <p>
              Both ingestion routes accept the same JSON envelope, limited to
              65,536 bytes (64 KiB). Send a <code>started</code> event before
              any subsequent event for a workflow/run pair.
            </p>
            <pre className={styles.schema}>
              <code>{eventExample}</code>
            </pre>
            <table>
              <caption>EventEnvelope · required and variant fields</caption>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Contract</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    <code>eventId</code>
                  </th>
                  <td>
                    Required UUID. Stable identifier for deduplication; retries
                    should reuse it.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.type</code>
                  </th>
                  <td>
                    Required: <code>started | step | properties | error | operation_started | operation_completed | operation_failed | progress | completed | failed</code>.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.workflow</code>
                  </th>
                  <td>
                    Required string, 1–200 characters, not whitespace-only.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.runId</code>
                  </th>
                  <td>
                    Required string, 1–200 characters, not whitespace-only. An
                    external identifier, not necessarily a UUID.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.timestamp</code>
                  </th>
                  <td>
                    Required string parseable by <code>Date.parse</code>. Use an
                    ISO 8601 timestamp with timezone.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.step</code>
                  </th>
                  <td>
                    Required only for <code>step</code>: string, 1–200
                    characters, not whitespace-only.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.properties</code>
                  </th>
                  <td>
                    Optional on <code>started</code> and <code>step</code>, and
                    required for <code>properties</code>. Properties are JSON
                    objects up to five nested levels, 128 keys, 128 characters
                    per key, 2,048 characters per string, and 16 KiB encoded.
                    Amendments append context without rewriting prior events.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.reason</code>
                  </th>
                  <td>
                    Legacy optional description on <code>failed</code>, limited
                    to 2,048 characters. Do not send secrets or sensitive
                    personal data.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.failure / event.error</code>
                  </th>
                  <td>
                    <code>failed</code> may include failure details{" "}
                    <code>{`{ code, message?, retryable? }`}</code>. An{" "}
                    <code>error</code> event requires{" "}
                    <code>{`{ code, message?, retryable?, handled }`}</code>{" "}
                    and does not terminate the run. Codes are limited to 128
                    characters; messages to 2,048.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.result</code>
                  </th>
                  <td>
                    Optional bounded JSON object on <code>completed</code>.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.environment / event.release</code>
                  </th>
                  <td>
                    Optional deployment metadata on <code>started</code>.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.operationId / operationName</code>
                  </th>
                  <td>
                    Required for operation events. Each independent operation
                    has its own UUID; terminal events repeat that ID and include
                    measured <code>durationMs</code>.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>event.progress</code>
                  </th>
                  <td>
                    Absolute snapshot with nonnegative safe-integer{" "}
                    <code>completed</code> and optional <code>total</code> and{" "}
                    <code>unit</code>. When total is present, completed must not
                    exceed it. Values are validated, never capped.
                  </td>
                </tr>
              </tbody>
            </table>
            <p className={styles.note}>
              CORS and public browser keys are not anti-abuse authentication.
              Treat browser events as untrusted telemetry, not billing,
              authorization, or proof of a business outcome. PostgreSQL is
              required for ingestion and protected reads; neither health route
              checks database readiness.
            </p>
          </section>
          <footer className={styles.footer}>
            <span>Flowmark · self-hosted workflow observability</span>
            <a href="http://localhost:3002/docs/local-development">
              Local setup & SDK guides ↗
            </a>
          </footer>
        </main>
      </div>
    </div>
  )
}
