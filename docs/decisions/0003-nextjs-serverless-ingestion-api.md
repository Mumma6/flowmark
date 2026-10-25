# ADR 0003: Next.js serverless ingestion boundary

- Status: accepted

## Decision

Use a small Next.js app for the HTTP/tRPC deployment boundary, intended for
serverless deployment. Keep application use cases, ports, and persistence
adapters in the framework-independent `@flowmark/api` package.

## Rationale

An ordinary HTTP endpoint is sufficient for an initial event API. It avoids queues, collectors, and streaming infrastructure before real usage requires them.

## Consequences

`/api/health` is live. `POST /v1/events` validates event envelopes, authenticates
project write keys, and commits idempotent events to PostgreSQL before
acknowledging them. Read APIs use separate project-scoped credentials.

`POST /v1/browser-events` is a separate public-key boundary, with `OPTIONS`
preflight, exact key-specific origin checks, and a database-backed quota.
Browser credentials cannot use private ingestion or tRPC reads. Public events
remain untrusted and use a separate `browser.` workflow namespace.

Dashboard reads use tRPC under `/api/trpc/[trpc]`. The `apps/server` route
adapters execute Effect services exported by `@flowmark/api`, with injectable
repository layers and scoped connections. The API package has no Next.js or
tRPC dependency, allowing another server adapter to reuse the same use cases
and ports.
Next.js can also run as an ordinary Node server; serverless deployment is an
option, not an operational prerequisite or a currently hosted service.
