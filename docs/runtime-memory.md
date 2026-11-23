# Runtime memory and coverage contract

This is the target domain and verification contract. Existing run and event contracts are described in [architecture](architecture.md). Storage may evolve within those boundaries.

## What is retained

| Record             | Identity and minimum fields                                                                                                                                                                 | Interpretation                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment         | Project, environment binding, repository/service ID, artifact digest, build revision, manifest digest and deployment interval or instance identity                                          | Several versions can serve concurrently. Rollback reactivates an artifact. A Git SHA or an SDK release string alone cannot establish deployment.                                                        |
| Behavior revision  | Stable behavior ID, versioned meaning and permitted fields, source sites with symbol/relative locator, stable probe IDs and supported runtime questions                                     | A file move may preserve meaning. A semantic split or changed unit gets a new revision. Dynamic or generated sites can be unresolved.                                                                   |
| Observation        | Project, behavior revision if known, workflow/run, attempt/operation, unique event ID, source channel, occurrence and receipt times, artifact/probe if known, typed decision or disposition | Technical completion, handled failure, business result, progress and later confirmation stay independent. A retry of delivery deduplicates by event identity. A new application attempt stays distinct. |
| Reference and link | Namespace and kind (entity, logical change, envelope, attempt or receipt), scoped opaque value, explicit edge kind and provenance                                                           | Two changes on one booking are distinct. Shared entity or timing permits lookup only. Explicit links support following an async boundary. Preserve partial order, forks, ambiguity and unlinked work.   |
| Evidence selection | Scope, exact window, definition versions, conditions, sampling, count method, observation time and authorized case handles                                                                  | Distinguish observed facts, application reports, source inferences and hypotheses. Known loss, missing fields, late records and expired support travel with the answer.                                 |

Capture selected operation codes and outcomes at the boundary that can attest them. Reuse a committed outbox event to report a committed move. An HTTP 202 supports acceptance. A later partner receipt supports acknowledgment. Recipient delivery requires its own source. Filter at origin using an allowlist and cardinality, byte and latency budgets. Default capture excludes credentials, headers, payloads, raw queries, arbitrary attributes and customer text. Namespace any linkable identifier per project and restrict its readers. A scoped HMAC can support exact equality where policy permits. Enforce expiry, erasure and revocation for mappings, citations and derived selections as well as the underlying events.

## Runtime Memory Coverage

The unit is a **versioned question about consequential behavior in a defined environment, artifact and eligible population**. For example, “Can an agent distinguish one redelivery from a second legitimate reschedule?” The identity and policy of the question must survive its probe being renamed or broken.

| Measurement            | Inputs and result                                                                                                                                                                                    | Example states                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Discovery              | Reconcile versioned source registrations with independent deployed entry points, jobs, queues and domain events. Record scope, adapter support, observation time and exclusions.                     | matched, source only, deployed only, unsupported, explicitly excluded                        |
| Readiness              | Question revision, importance, eligibility predicate, required facts/links, meaning, test fixture, expected answer, counterexample, tested artifact/manifest, persisted readback and policy checks.  | verified, missing, stale, failed, excluded with rationale                                    |
| Observed answerability | Same question on a deployed artifact, observation window, maturity delay, independent denominator identity, scoped distinct eligible cases, resolved cases, unknowns, drops, sampling and freshness. | observed, partial, waiting for eligible traffic, unknown population, known loss, unsupported |

Count each eligible logical case once. Compute the numerator by joining resolved admissible cases to the same eligible population. An independent scoped outbox containing 200 mature distinct changes and evidence answering 192 gives 192/200 with eight unresolved. A sampled collector with 192 examples and no independent counter gives 192 retained examples and an unknown rate. Incompatible revisions, biased sampling, overlapping cohorts or a missing population key can invalidate a comparison. Zero independently observed eligible cases means waiting. Missing or stale counters mean unknown. Keep low-volume critical questions visible and give each exclusion an owner and reason. Dropping a question or changing a denominator appears in the PR diff.

`discover_boundaries` performs the discovery row. It reconciles at most 24 source registrations with deployment receipts and an independent inventory, including a renamed route, a deployed-only worker, an ambiguous event, an inaccessible service and an already sufficient signal. It does not read a telemetry feed, so an unexercised path has no observed case.

`assess_coverage` returns discovery, fixture readiness and observed answerability separately for one question. It joins an independent population of at most 200 cases to project-scoped evidence and counts each logical case once. A missing counter, changed sample, expired question or unsupported join does not become a rate. Production traffic is not a merge gate.

## Verification and maintenance

1. **PR.** Diff the inventory, question contracts, mappings and field policy. Exercise the actual emitter, delivery and authorized read path on a local fixture. Test an expected case and a discriminating counterexample, including rollback, redelivery or late confirmation where relevant. A critical applicable question with failed or stale readiness can fail CI. Production traffic is never a pre-merge requirement.
2. **Deployment.** Bind the manifest to the deployed artifact and routing environment. Split mixed artifacts. Start the maturity window from eligible work. A passed staging fixture remains staging evidence.
3. **Runtime.** Reconcile independent activity with evidence. Delay conclusions until the window matures. A queue reporting completed work with repeatedly missing joins is a capture gap. A provider with no delivery receipts is an unsupported question.
4. **Repair.** Record the question, affected site, observed symptom and smallest useful change. Deduplicate proposals by repo, behavior, question and failing revision. Attach the fix and its test to the open feature PR when applicable, otherwise open one scoped repair PR. Suppress repeats while open and re-evaluate after merge and deploy. Only fixture readback establishes restored readiness. Only eligible live cases establish restored observed answerability.
5. **Presentation.** MCP returns the three results independently with reason codes, revision, count units and citations. Studio renders the same response with labels, last observation and repair link. Rechecking after expiry, late arrival or revocation can change what the viewer can establish.

### Build artifact manifest

See also the [repository-owned question check](#check-a-repository-owned-runtime-question) for verifying these mappings with fixture events.

The version 1 manifest records a repository, full Git revision, SHA-256 digest
of the built file and up to 1,024 declared probes. Keep the probe and behavior
IDs when moving code. Update the behavior revision when its meaning changes.
Mark generated locations and list candidate paths and symbols when the source
location is ambiguous.

Build the core package, then produce the manifest alongside the build artifact.
The booking fixture provides an example declaration file.

```sh
pnpm --filter @flowmarkdev/core build
node scripts/build-artifact-manifest.mjs path/to/built-file \
  examples/booking-redelivery-probes.json "$(git rev-parse HEAD)" > artifact-manifest.json
```

The manifest describes the build. Deployment identity requires a separate
trusted receipt.

### Deployment receipts

A project owner uses the Studio API mutation `project.rotateDeploymentBinding`
to create or rotate a credential scoped to a project, repository, service and
environment. Store the returned token in the secret store of the deployment
system that can attest which artifact it deployed. Rotating the token keeps
the binding ID and its receipt history. The system stores a hash of the token.

### Repository and environment installation under policy

A project owner connects a GitHub repository and Node runtime to a project and
environment from Studio (`Connect`) or via `repositoryInstallation.connect`.
Connecting binds four authorities separately:

- **Repository PR writer**: narrow `contents:write`, `pullRequests:write` and
  `metadata:read` permissions on the selected repository only. Merge and
  repository administration permissions are rejected.
- **Deployment attestation**: reuses the project's scoped deployment binding
  (`FLOWMARK_DEPLOYMENT_TOKEN`, stored hashed and revealed once at creation).
- **Ingestion**: ordinary server write key (`FLOWMARK_API_KEY`) scoped to the
  project; kept out of bootstrap PR files and chat.
- **Diagnostic reads**: separate delegated OAuth/API read identity used to
  verify disposable readback (`repositoryInstallation.verifyDisposableReadback`).

Each installation declares explicit collection policy: allowed reference
namespaces (`kind:namespace`), retention window (1–90 days), max event byte
budget, overhead budget (1–100 ms), rate budget, and `allowRawPayloads: false`.
The deterministic bootstrap PR plan (`flowmark/connect-<service>-<env>`) adds
`.flowmark/install.json`, a policy-checked Node helper, manifest script,
disposable test, a Cursor planning/review rule and a marked section in
`AGENTS.md`. Repeating the install replaces that section and leaves the rest
of the file in place. Cursor is the host whose rule actually runs. Other hosts
keep the instruction and record the read as unavailable.

Before eligible traffic arrives, cold-start status explicitly distinguishes
`pending-deployment-receipt` (waiting for the first deployment attestation) from
`pending-eligible-traffic` (bootstrap readback verified, waiting for live
traffic). Webhook deliveries at `POST /v1/installations/github` verify the
HMAC-SHA256 `x-hub-signature-256` signature, validate installation and
repository ownership, deduplicate repeated delivery IDs, reject stale
timestamps, and revoke only the installation's linked delegated grant family on
uninstall while leaving independently issued credentials intact.

After a successful deployment, that system sends `POST /v1/deployments` with
`Authorization: Bearer <token>` and a JSON body of up to 64 KiB:

```text
{ bindingId, deploymentId, manifest }
```

Use the provider's deployment instance identifier for `deploymentId`. Repeat
callbacks with equivalent manifests return the same receipt. Reusing an ID
with different evidence returns HTTP 409. A rollback uses a new deployment ID
with the original artifact manifest. Multiple artifacts can remain in the
history at once. The receipt records callback arrival time and does not
establish a serving interval.

Project owners can read an exact receipt through `project.deploymentReceipt`.
A receipt proves that a credential scoped to the binding reported the
deployment. Keep credentials off browsers and ordinary application
instrumentation. Provider-specific setup is separate.

### Recording a bound observation

On the server, create an emitter from the Node or Next SDK entry point. Pass the
deployment binding ID, deployment instance ID, artifact digest and stable probe
ID from the build and deployment configuration. Supply a project-specific
reference key of at least 32 characters from the application secret store and
declare the entity, logical change and envelope namespaces collection policy
allows. Keep raw values out of ordinary workflow properties.

```ts
const emitter = createRuntimeObservationEmitter({
  key: referenceKey,
  namespaces: [
    { kind: "entity", namespace: "booking" },
    { kind: "change", namespace: "reschedule" },
  ],
  probe: {
    bindingId,
    deploymentId,
    artifactDigest,
    probeId: "booking-delivery",
  },
})

emitter.observe(flow, {
  entity: { booking: bookingRef },
  change: { reschedule: changeId },
})
```

The emitter only sends HMACs for declared references. It neither sends the key
nor copies the supplied object into telemetry. With `enabled: false`, the emitter
does no work. Application code keeps ownership of its return values and errors.

The accepting server joins the submitted probe to a receipt owned by the same
project. Missing receipts, conflicting environments, digest mismatches and
unsupported probe locations leave the binding unknown. The observation still
has its own event ID, occurrence time and receipt time. An HTTP retry preserves
the event ID. An application retry has its own execution and events.

Application collectors can call `emitter.reportLoss(flow, count)` to report a
known omission while delivery is available. Transport errors and queue drops
also remain visible in SDK delivery health.

### Context for a code change

`context_for_change` version 1 accepts an authorized project ID, repository,
a run-start window of up to 31 days, and a ticket, plan, diff, relative file
path or symbol. An optional environment narrows the deployment scope. Pass
the checkout's full Git revision when available.

The tool ranks exact source mappings ahead of explicit Git renames and
lexical ticket or plan matches. Mappings from other revisions remain
adjacent evidence. Ambiguity is visible when competing candidates tie or an
artifact cannot identify a unique source location. The tool only inspects
diff paths and rename headers and leaves patch text out of its response.

An optional versioned `question` turns the read toward a supported
distinction such as `receipt-for-same-change`. The response includes
`questionEvidence` with a supporting case, a contrary case when observed,
citation handles, the missing fact or link when evidence supports that
diagnosis, and explicit scan limits. The ordinary bounded candidate list
remains available when the field is omitted.

It considers up to 12 deployment receipts and reads up to four ranked probe
candidates. Each supported candidate can return a representative example
and a contrasting example with recorded event IDs. The comparison uses
recorded outcomes, status or multiple envelope references for one recorded
change. That last shape shows several envelopes, while their business
meaning still depends on the application. Use `explain_execution` with a
returned run ID to inspect the evidence.

The response distinguishes one observed artifact, evidence across multiple
artifacts, and no observed cases. Evidence across artifacts can come from
different times within the window. When scope exceeds a read limit, narrow
the environment or window. Missing observations and truncated samples
remain explicit.

### Cite runtime evidence in a pull request

When a `context_for_change` candidate includes examples, copy its `citation`
URL into the PR. Keep execution IDs, payloads and entity references out of the
PR. The URL contains an encrypted reference to the selected observations,
artifact, time window and sample size. Studio checks the reviewer's current
diagnostic access to the cited project before showing those observations. If
prompted to sign in, reopen the original PR link after signing in.

The sample stays pinned when new events arrive. Citations expire after 24 hours
and become invalid after an auth secret rotation. If the underlying observations
have been removed, request a new citation. Project erasure or access revocation
prevents further reads.

### Compare two deployments of a behavior

`compare_behavior` version 1 selects one authorized project, deployment
`bindingId`, workflow and `behaviorId`. Supply `before` and `after` with
distinct deployment IDs and ordered, non-overlapping run-start windows of up
to 31 days. Windows include their start and exclude their end. The binding
fixes the repository, service and environment. Both receipts must declare the
same behavior revision with a source probe. Change that revision when the
meaning of the signals changes.

Specify the same `fallbackStep`, `normalStep` and `partialOutcome` for both
deployments. An eligible run has a bound observation for the selected
deployment, artifact and behavior revision. Runs with competing deployment
observations under that binding are excluded. Counts are per eligible recorded
run and categories may overlap.

- `handledError` requires a recorded error marked handled.
- `fallback` requires the named step.
- `partialOutcome` requires a terminal event with the requested outcome code.
- `normalPath` requires the named step and a recorded completion outside
  that partial outcome. Absence of a fallback marker never establishes normal.

Each count includes matching examples with the bound observation and signal
event IDs. Repeat the selection with `drilldown: { cohort, metric }` to page
those executions, passing `nextAfterRunId` as `afterRunId` on the next call.
Use `explain_execution` for the surrounding evidence. A call reads both
cohorts from one database snapshot. Later calls read current retained evidence.

Changed or unknown caller-declared `samplingPolicy`, fewer than five eligible
runs on either side, mixed traffic, unattributed runs and known reported loss
produce explicit limits. The tool reports retained counts and examples.
It cannot verify a sampling policy, estimate rates across all traffic or
attribute a difference to the deployment. If either window exceeds 1,000
candidate runs or 20,000 events, narrow the selection to get a complete count.

### Check a repository-owned runtime question

The [receipt declaration](../examples/questions/committed-receipt.json) asks whether the application committed a receipt for the original logical request. Version 1 supports one predicate, `receipt-for-same-change`. It checks the scoped change reference reported at two stable probe sites within a controlled execution. Both sites must resolve to source in the fixture artifact. File and symbol moves can preserve their IDs. Change the question revision when the choice, eligibility, linkage, or exclusion changes. Change the behavior revision when the reporting sites change meaning.

In a disposable fixture, commit a receipt for the same request, commit one for a different request, and force a transaction rollback. Assert the actual database effects independently. Report the receipt only after commit. Close each run, drain SDK delivery, and fail the fixture on lost or failed delivery. Resolve each fresh external run ID to its internal execution ID using an authorized run read. The [executable fixture](../apps/server/test/http/runtime-question.test.ts) includes two deliberately broken observation placements. Run it with `pnpm test:integration`.

Call `POST /api/trpc/run.questionReadiness` with a diagnostic project read credential and a JSON body. The fixture supplies the following inputs:

- `question` is the checked-in declaration. For an existing question, supply `previousQuestion` from the reviewed base revision. Removing a required declaration should fail the repository's CI check.
- `questionId`, `questionRevision`, `fixture` and `allowedChangeNamespaces` come from the reviewed CI policy, independently of the candidate declaration. Only scoped change digests are supported. For deliberate retirement, retain the revised declaration with `excludedReason` and supply the matching `approvedExclusion` from policy. These inputs constrain this check. They grant no collection or read authority.
- `environment`, `bindingId`, `deploymentId`, `sourceRevision` and `artifactDigest` identify the fixture build and its deployment receipt. The question can keep its meaning across environments. `runs` maps `linked`, `otherRequest` and `rollback` to three distinct internal IDs. Use the runs from this fixture invocation.

The response contains a status, a reason and, for a case-specific limitation, the fixture case name. A check looks up the exact deployment receipt and reads at most 25 observation events per case.

| CI status  | Meaning                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `verified` | Both committed cases contain the required distinction. The rolled-back run contains the request marker and no commit marker. |
| `missing`  | A fixture, receipt, observation or required reference is absent from the checked scope.                                      |
| `stale`    | The declaration or source mapping disagrees with the fixture build or its observations.                                      |
| `failed`   | The fixture contradicts the expected distinction, violates field policy, reports loss or exceeds the read budget.            |
| `excluded` | The declaration and reviewed CI policy explicitly agree on the exclusion.                                                    |

For a required active question, require `result.data.status === "verified"`. Keep authorization, malformed input and transport failures as errors. Report only the safe verdict in public CI. Fixture readiness applies to the tested build and collection path. A production claim requires separately observed eligible traffic.
