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
| Delegated OAuth discovery, project grants, refresh/revocation and bounded read-only MCP tools                                     | `packages/auth`, `packages/mcp`, server adapters; [MCP](../packages/mcp/README.md), [security audit](./agent-access-security-audit.md)                              |
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

## Runtime context for coding agents

Diagnostic agents can use `find_executions` and `explain_execution` to retrieve
scoped runtime cases with observations and delayed settlements. See the
[versioned tool contract](decisions/0021-runtime-execution-reads.md).
`context_for_change` retrieves bounded candidates and cases from deployment
receipts for an explicit repository and time window. Ticket and plan matching
use lexical hints. `compare_behavior` compares retained run counts and
matching cases across two deployment windows with compatible behavior revisions.
The existing MCP investigation tools remain available. `discover_boundaries`
reconciles source registrations with stored deployment receipts and an
independent inventory. It reports where a fact can first be attested and does
not read executions.

`propose_observation_repair` turns one diagnosed gap into the smallest in-policy change: reuse a trusted event, repair a mapping, add a permitted reference, or add one typed observation. A denied read, immature traffic or a restricted field adds no capture. The proposal stays on one branch and does not merge itself. Production evidence stays pending.

`assess_coverage` returns discovery, fixture readiness and observed answerability as separate results for one question, release, environment and window. It joins an independent population to project-scoped evidence, counts each logical case once, and withholds a rate when the counter, sampling, support or join cannot support one. Eligible production traffic is not a CI gate.

`maintain_questions` re-evaluates that question when source, deployment or traffic changes. A moved probe keeps its meaning. A semantic split records the next revision and leaves earlier cases on the previous meaning. Repeated triggers for the same installation, behavior, question and revision become one repair, attached to the open feature change when that pull request is still the right place. A wait, insufficient authority, revocation or expired support opens no instrumentation. Fixture readback restores readiness. Only eligible observations on the repaired deployment restore live answerability. The fresh read contains no earlier transcript.

Review carries the decision, the intended guarantee, the ordinary regression test, one citation, a contrary case and any missing evidence. Protected payloads and identifiers stay out of the pull request. A reviewer reopens a citation under that reviewer's own grant. An expired or denied citation states the limitation and includes no case. The booking reschedule fixture is synthetic: deduplicating by the logical change yields one suppression, two intents and two acceptances, and recipient delivery stays unknown. Deduplicating by the envelope or the booking reference fails that guarantee. Test expectations come from the application intent, including a test that asserts the opposite of an observed bug.

Connected repositories can check a versioned receipt question in CI against
three persisted fixture executions. The API checks an authorized deployment
mapping, scoped change links and the rollback control. [Fixture readiness](runtime-memory.md#check-a-repository-owned-runtime-question)

Project owners can connect a GitHub repository and Node environment under
explicit field, retention and overhead policy via Studio and
`repositoryInstallation` procedures, receive a scoped deployment token and
deterministic bootstrap PR plan, handle signed installation webhooks at
`POST /v1/installations/github`, and verify disposable readback with a separate
diagnostic read identity. The bootstrap PR installs a Cursor planning and
review rule plus a repository instruction that preserves unrelated guidance.
[Repository installation](runtime-memory.md#repository-and-environment-installation-under-policy)

## Planned product capabilities

Estate discovery, policy-driven instrumentation repairs,
population-level observed answerability and post-deploy verification remain planned. Current
Studio includes analytics and collaboration routes slated for removal. See
[the target surfaces](product.md) and [coverage](runtime-memory.md).
