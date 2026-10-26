const stack = [
  ["TypeScript", "Shared types", "Apps, SDK and domain contracts"],
  [
    "Next.js · React",
    "Application framework",
    "API routes, dashboard, landing and docs",
  ],
  [
    "Effect · Effect Schema",
    "Internal foundation",
    "Services, typed errors, validation and delivery",
  ],
  [
    "tRPC · TanStack Query",
    "Dashboard data",
    "Typed reads, client cache and polling",
  ],
  [
    "PostgreSQL · Drizzle · Studio",
    "Persistence",
    "Transactions, schema, migrations, queries and database browser",
  ],
  [
    "shadcn/ui · Radix · Tailwind",
    "Interface",
    "Shared UI primitives and app styling",
  ],
  ["Fumadocs · MDX", "Documentation", "Separate customer and internal apps"],
  [
    "pnpm · Turborepo · Vitest",
    "Workspace tooling",
    "Dependencies, task graph and tests",
  ],
] as const

function Node({
  title,
  tech,
  detail,
  tone = "",
}: {
  title: string
  tech: string
  detail: string
  tone?: string
}) {
  return (
    <div className={`arch-node ${tone}`}>
      <strong>{title}</strong>
      <span>{tech}</span>
      <small>{detail}</small>
    </div>
  )
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="arch-arrow">
      <span>{label}</span>
      <span aria-hidden="true">↓</span>
    </div>
  )
}

export function ArchitectureOverview() {
  return (
    <div className="architecture-overview">
      <p className="arch-intro">
        Application code reports events. The API validates and stores them. The
        dashboard reads the resulting workflow history.
      </p>

      <section aria-labelledby="system-map">
        <h2 id="system-map">System map</h2>
        <figure className="arch-figure">
          <div className="arch-pair">
            <div>
              <Node
                title="Browser application"
                tech="@flowmarkdev/node/browser"
                detail="Public browser key · allowed Origin"
              />
              <Arrow label="POST /v1/browser-events" />
            </div>
            <div>
              <Node
                title="Server / Next.js application"
                tech="@flowmarkdev/node · @flowmarkdev/node/next"
                detail="Secret write key · Next after() flush"
              />
              <Arrow label="POST /v1/events" />
            </div>
          </div>
          <Node
            title="Flowmark API :3003"
            tech="Next.js routes → Effect services"
            detail="Authorization → Schema validation → repository"
            tone="arch-node-api"
          />
          <Arrow label="Commit transaction before acknowledging ingestion" />
          <Node
            title="PostgreSQL"
            tech="Drizzle ORM · postgres driver"
            detail="Projects → workflows → runs → append-only events"
            tone="arch-node-db"
          />
          <Arrow label="Project-scoped reads through API services + tRPC" />
          <Node
            title="Dashboard :3001"
            tech="Next.js · React · TanStack Query"
            detail="Server-side read key → same-origin tRPC proxy → UI"
          />
          <figcaption>
            Write and read paths are separate. Browser credentials cannot read
            dashboard data. This is the current self-hosted architecture, not a
            hosted Flowmark service.
          </figcaption>
        </figure>
      </section>

      <section aria-labelledby="event-journey">
        <h2 id="event-journey">One event, end to end</h2>
        <ol className="arch-journey">
          {[
            [
              "1",
              "Instrument",
              "flow.step(), error(), setProperties(), done() or fail()",
            ],
            [
              "2",
              "Deliver",
              "SDK validates, sequences and sends with bounded retries",
            ],
            [
              "3",
              "Ingest",
              "API resolves project, validates envelope, deduplicates event UUID",
            ],
            ["4", "Persist", "Database transaction stores the event durably"],
            [
              "5",
              "Inspect",
              "Dashboard polls typed queries and renders run evidence",
            ],
          ].map(([number, title, description]) => (
            <li key={number}>
              <span className="arch-number">{number}</span>
              <strong>{title}</strong>
              <small>{description}</small>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="effect-boundaries">
        <h2 id="effect-boundaries">Where Effect runs</h2>
        <div className="arch-boundaries">
          <Node
            title="Public boundary"
            tech="Ordinary TypeScript / Promises"
            detail="SDK methods · HTTP handlers · tRPC procedures"
          />
          <Arrow label="Explicit runtime execution" />
          <Node
            title="Internal services"
            tech="Effect<A, E, R> · Effect.gen / Effect.fn"
            detail="Injectable dependencies composed with layers"
            tone="arch-node-api"
          />
          <Arrow label="External adapters" />
          <Node
            title="Network & database"
            tech="Effect HttpClient · scoped DB service"
            detail="Timeouts, cancellation, resource cleanup and typed failures"
          />
        </div>
      </section>

      <section aria-labelledby="technology-stack">
        <h2 id="technology-stack">Technology stack</h2>
        <div className="arch-stack">
          {stack.map(([name, role, usage]) => (
            <div key={name}>
              <span>{role}</span>
              <strong>{name}</strong>
              <small>{usage}</small>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="workspace-map">
        <h2 id="workspace-map">Workspace map</h2>
        <div className="arch-pair">
          <div className="arch-workspace">
            <h3>Applications</h3>
            <dl>
              <div>
                <dt>Drizzle Studio :4983</dt>
                <dd>Local database browser · starts with pnpm dev</dd>
              </div>
              <div>
                <dt>web :3000</dt>
                <dd>Public landing</dd>
              </div>
              <div>
                <dt>dashboard :3001</dt>
                <dd>Workflow investigation</dd>
              </div>
              <div>
                <dt>docs :3002</dt>
                <dd>Customer guides</dd>
              </div>
              <div>
                <dt>api :3003</dt>
                <dd>Ingestion + queries</dd>
              </div>
              <div>
                <dt>dev-harness :3004</dt>
                <dd>Loopback-only SDK development fixture</dd>
              </div>
              <div>
                <dt>internal-docs :3005</dt>
                <dd>This local-only reference</dd>
              </div>
            </dl>
          </div>
          <div className="arch-workspace">
            <h3>Shared packages</h3>
            <dl>
              <div>
                <dt>core</dt>
                <dd>Event types + boundary schemas</dd>
              </div>
              <div>
                <dt>sdk</dt>
                <dd>Published as @flowmarkdev/node</dd>
              </div>
              <div>
                <dt>db</dt>
                <dd>Schema, migrations + storage</dd>
              </div>
              <div>
                <dt>ui</dt>
                <dd>Shared shadcn/Radix primitives</dd>
              </div>
              <div>
                <dt>config</dt>
                <dd>Shared tooling configuration</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <aside
        className="arch-limitations"
        aria-label="Current architecture limits"
      >
        <strong>Current boundaries</strong>
        <ul>
          <li>Observability, not a workflow execution engine.</li>
          <li>
            SDK delivery is best-effort and in-memory, not a durable queue.
          </li>
          <li>
            Browser reports are untrusted; origin checks are not user
            authentication.
          </li>
          <li>
            Dashboard uses a fixed demo account; production user auth is not
            implemented.
          </li>
          <li>
            Operations and progress are recorded within a run. Related runs use
            explicit correlation and parent IDs, not automatic distributed
            tracing.
          </li>
        </ul>
      </aside>
    </div>
  )
}
