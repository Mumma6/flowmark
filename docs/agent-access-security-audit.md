# Composed agent-access security audit

This audit covers the provider → grant → MCP → persistence composition on the
11 November 2026 implementation, based on staging `8fe5807`. Tests use synthetic
accounts and evidence in disposable loopback PostgreSQL. This is local protocol
and persistence verification, not a commercial-client compatibility or hosted
penetration-test claim.

## Defects corrected

- **MCP ingress authority:** the pinned SDK leaves Origin/Host policy to its
  caller. Flowmark now checks the request URL and Host against the configured API
  hostname before body/token processing. A present Origin must exactly equal the
  configured API or issuer origin, including scheme and port. Native clients
  can omit Origin. Forwarded headers cannot authorize another host or origin.
  Denial is a fixed, uncached 403. Additional browser origins need a reviewed
  policy; this change grants no CORS access.
- **Event cursor context:** a cursor previously accepted another authorized
  run's ordering tuple and could skip evidence. Its existing wire format is
  preserved, but its event id and both timestamps must match a stored event in
  the selected run/project. Malformed, substituted, forged or deleted-event
  cursors fail explicitly. The existing ownership query performs an indexed,
  metadata-only lookup; no payload history is loaded for this check.
- **Provider diagnostics:** Better Call's unexpected-error fallback could log a
  raw driver error outside Better Auth's configured logger. Provider exceptions
  now reach Flowmark's existing Effect HTTP boundary, which emits only approved
  diagnostic fields and a generic no-store 503. Native API errors and redirects
  retain provider handling.

## Composition matrix

Paths below are relative to the repository root. Existing regression suites are
reused alongside the missing cross-boundary cases.

| Boundary            | Exercised behavior                                                                                                                                                                                   | Evidence                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| HTTP ingress        | Canonical/no Origin allowed; foreign/opaque/malformed Origin, rebound Host/URL and forged forwarded authority denied before body reads; no reflected token/header                                    | `packages/mcp/test/request-authority.test.ts`; `apps/server/test/http/mcp-agent-access.test.ts`              |
| Signed bearer       | Wrong issuer/resource/scope/expiry/family, foreign subject/client/family denied; test tokens use the real provider signing key                                                                       | `apps/server/test/http/mcp-agent-access.test.ts`                                                             |
| OAuth lifecycle     | PKCE absent/wrong verifier, expired/replayed code, wrong refresh resource and late refresh replay denied; refresh retains the exact family                                                           | `packages/auth/test/agent-access-grant-family.test.ts`                                                       |
| Live grant          | Foreign project/run/declaration, changed cursor section, stale consent, membership loss and revocation denied; a separately constructed, already-warmed handler observes revocation                  | Server MCP HTTP suite; `packages/db/test/persistence/delegated-grant-isolation.test.ts`                      |
| Cursor integrity    | Cross-run, unknown-event and changed-timestamp event cursors denied; legitimate paging and microsecond precision preserved; real EXPLAIN returns one indexed metadata match                          | `packages/db/test/persistence/bounded-read-parity.test.ts`; `packages/db/test/run-event-page-cursor.test.ts` |
| Write separation    | MCP bearer cannot ingest, create/rename projects, create/rotate/revoke keys or write result declarations; ordinary session/key flows still work                                                      | Server MCP HTTP, ingestion and authenticated-ingestion suites                                                |
| Metadata/redirects  | Dynamic registration and URL client ids denied without an outbound fetch; signed provider redirects remain constrained; untrusted source/proxy identity rejected                                     | Server MCP HTTP suite; `packages/auth/test/agent-access-regression.test.ts`; dashboard proxy tests           |
| Shared cost bounds  | Forty concurrent decisions through two DB connections respect the ten-admission fixture budget; independent grants stay separate; real SQL deadline/cancellation leaves no active query              | `packages/db/test/persistence/mcp-budgets.test.ts`                                                           |
| Evidence bounds     | Large histories page without changing full-cohort analytics; body/result caps, shrinking pages and explicit oversized-record/operation limitations hold; interrupted body reading cancels its stream | DB/API bounded-read parity suites; `packages/mcp/test/budgets.test.ts`; server MCP HTTP suite                |
| Storage/diagnostics | Unavailable persistence denies reads; provider storage failures return generic 503; errors/logs exclude synthetic token, driver and telemetry canaries                                               | Server MCP HTTP, auth-perimeter and durable-auth-limits suites; MCP grant-family tests                       |
| Hostile evidence    | An instruction containing a metadata-service URL remains evidence; Flowmark does not fetch that URL, execute it or log the raw payload                                                               | Server MCP HTTP six-tool investigation test                                                                  |

## Interpretation and limits

The provider deliberately permits immediate refresh retries during its rotation
replay grace. The replay test expires only its fixture's grace before asserting
denial; it does not claim every repeated refresh is immediately rejected.

Requests and full UTF-8 tool results are capped at 64 KiB, tool execution at
15 seconds and SQL statements at 5 seconds. Page limits and compact database
projections apply before model serialization; oversized results fail explicitly
or shrink to a valid page. These are admission, query and result bounds, not a
guarantee of constant database work for every aggregate or a production load test.

Authorized diagnostic evidence can contain customer text, URLs and secrets that
the application reported. It is not automatically redacted or trusted as an
instruction. The hostile-evidence test proves the server performs no requested
network/action side effect; it cannot establish prompt-injection immunity in a
downstream model. Applications own work execution and reported results remain
reported evidence, not proof of business correctness.

Codex CLI, Cursor desktop, Claude Code and custom-client lifecycle verification
remain separate work. No hosted settings, database migration, rollout, dependency
upgrade or telemetry reset is part of this audit. Other public cursor formats
retain their existing scoped-query behavior; this correction addresses the
confirmed event-page context defect without a cursor-protocol redesign.

The HTTP policy follows the MCP
[transport security requirements](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
and the installed SDK's caller-owned validation contract. See the
[auth perimeter](./auth-perimeter.md) and
[protocol decision](./decisions/0008-connect-agent-protocol-contract.md) for the
underlying authority and budget policy.
