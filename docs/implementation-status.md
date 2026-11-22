# Implementation status

Source inventory at staging `01cf413`, 21 November 2026. This is the baseline for the [product contract](product.md). Hosted activation and client compatibility have separate verification records.

## Implemented foundation

| Capability                                                                                                                        | Source owner and authoritative guide                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node, Next.js and browser SDK; typed definitions, outcomes, reports, progress, operations, retries, continuation and expectations | `packages/sdk`, `packages/core`; [SDK](../packages/sdk/README.md), [contracts](./sdk/result-contract.md), [expectations](./sdk/expectations.md)                     |
| Studio Explore, search, run inspector, timelines, comparisons and attention views                                                 | `apps/dashboard/features`; [Studio](../apps/dashboard/README.md)                                                                                                    |
| Reviewed code-owned result revisions and search-field imports                                                                     | API result-declarations feature; [definition imports](./definition-imports.md)                                                                                      |
| Qualified reference journeys and linked execution comparisons                                                                     | API workflow use cases, DB query owners; [journeys](./reference-journeys.md), [comparisons](./linked-process-comparisons.md)                                        |
| Private live investigations, authenticated sharing and bounded business evidence captures                                         | API/store features and Studio; [private selections](./saved-investigations.md), [shared evidence](./shared-investigations.md)                                       |
| Fixed project owner, diagnostic viewers and owner-published business-reader evidence                                              | API project-sharing/business-evidence features; [sharing](./project-sharing.md), [projections](./business-evidence.md)                                              |
| Account recovery, optional email verification, password/session controls and verified email changes                               | `packages/auth`, API account features; [auth boundary](./auth-perimeter.md), [account security](./account-security.md), [email changes](./account-email-changes.md) |
| Bounded account/project exports, erasure fencing and resumable deletion                                                           | API lifecycle/export features and DB stores; [exports](./data-exports.md), [lifecycle](./data-lifecycle.md)                                                         |
| Delegated OAuth discovery, project grants, refresh/revocation and six bounded read-only MCP tools                                 | `packages/auth`, `packages/mcp`, server adapters; [MCP](../packages/mcp/README.md), [security audit](./agent-access-security-audit.md)                              |
| Ordinary TypeScript public read client and standalone query-to-view example                                                       | `@flowmarkdev/node/read`, server `/v1/read/run` and `/v1/read/period`; [run reads](./sdk/public-run-read.md), [period reads](./sdk/public-period-read.md)           |
| Supplied-data portable view and one locally tested MCP Apps reference-host boundary                                               | `packages/evidence-view`; [compatibility](../examples/portable-evidence/COMPATIBILITY.md)                                                                           |
| Deterministic operation summaries, percentiles, peer comparison and cycle detection                                               | Rust `crates/flowmark-engine`, TypeScript `packages/engine`; [Engine](./engine.md)                                                                                  |
| Local contributor path, synthetic examples, help and session-expiry recovery                                                      | [Contributing](../CONTRIBUTING.md), [examples](../examples/README.md), [troubleshooting](../apps/docs/content/docs/troubleshooting.mdx)                             |

These capabilities preserve application-owned execution. Completion is reported
telemetry, not verified business correctness. Missing terminal evidence proves
neither activity nor failure. Related/linked samples are not a complete conversion
funnel, and release associations do not establish causality.

## Explicit deferrals and limitations

- Cursor is the primary supported MCP client. The maintainer verified its
  Staging connection with real MCP calls against application data (reported
  17 November 2026). Full cross-version and cross-client lifecycle certification
  and the client showcase remain deferred. Reference HTTP/Codex evidence is not
  proof of compatibility with every commercial client. Use each compatibility
  document's exact tested versions and limitations.
- Broad whole-product accessibility, assistive-technology, reduced-motion and
  design acceptance is deferred. Targeted browser checks do not certify the
  entire product. Concrete functional/accessibility bugs remain actionable.
- Hosted capture admission and cleanup are not enabled merely by source support.
  Physical expiry needs approved cadence, monitoring, missed-run recovery and
  environment-specific evidence. Exported copies cannot be recalled.
- Source permission and lifecycle tests do not establish a completed hosted
  rollout, privacy/legal acceptance, backup restore or incident rehearsal.
- Optional MFA and shorter retention controls are not required 1.0 capabilities.

## Operational follow-ups

Before exposing the relevant capability, record its exact deployed revision,
configuration and migration state through the existing [rollout](./migrations.md)
and [release](./releases.md) workflows. Preserve separate approval for hosted
operations and every npm publish.

Remaining records include email plan/quota/cost and bounce/complaint monitoring;
operator/privacy disclosures and rights/incident/backup procedures; continued environment-specific
Cursor sign-in checks after server changes; and capture/cleanup
operating cadence. MCP itself is no longer behind an environment flag.

## More recent implemented work

- Agent-guided setup serves compiled SDK examples and reads the first stored run through the existing MCP connection. A loopback Codex client exercised delegated reads. Maintained repo installation and independent model-driven repair are still delivery work. [Served guide](../apps/server/src/instrumentation-guide.ts)
- Scoped process-health queries separate terminal execution, reported outcome and evidence quality. Outcome comparisons retain exact populations and drilldowns. Reuse these mechanics for change evidence. [Process health](process-health.md)
- Reviewed process definitions and candidate review distinguish source suggestions from recorded examples. The Studio gap handoff can prepare an SDK patch brief. It needs a durable mapping to the artifact that ran. [Definitions](definition-imports.md)
- A local compatibility probe compared explicit operation, selected dependency signals and trace references. The explicit operation already explained the primary provider failure. General automatic collection remains unshipped. [Probe results](sdk/capture-compatibility-probe.md)

## Planned product capabilities

Repository and environment installation, automatic change-to-case lookup, policy-driven instrumentation repairs, question-level coverage and post-deploy verification are design targets. Today the MCP entry points are `get_connection`, `list_workflows`, `find_runs`, `get_run`, `compare_run` and `get_workflow_insights`. Diagnostic agents can also use `find_executions` and `explain_execution` to retrieve scoped runtime cases with recorded observations and settlements. See the [versioned tool contract](decisions/0021-runtime-execution-reads.md). Current Studio includes analytics and collaboration routes slated for removal. See [target surfaces](product.md) and the [coverage contract](runtime-memory.md).
