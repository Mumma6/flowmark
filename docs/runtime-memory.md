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

## Verification and maintenance

1. **PR.** Diff the inventory, question contracts, mappings and field policy. Exercise the actual emitter, delivery and authorized read path on a local fixture. Test an expected case and a discriminating counterexample, including rollback, redelivery or late confirmation where relevant. A critical applicable question with failed or stale readiness can fail CI. Production traffic is never a pre-merge requirement.
2. **Deployment.** Bind the manifest to the deployed artifact and routing environment. Split mixed artifacts. Start the maturity window from eligible work. A passed staging fixture remains staging evidence.
3. **Runtime.** Reconcile independent activity with evidence. Delay conclusions until the window matures. A queue reporting completed work with repeatedly missing joins is a capture gap. A provider with no delivery receipts is an unsupported question.
4. **Repair.** Record the question, affected site, observed symptom and smallest useful change. Deduplicate proposals by repo, behavior, question and failing revision. Attach the fix and its test to the open feature PR when applicable, otherwise open one scoped repair PR. Suppress repeats while open and re-evaluate after merge and deploy. Only fixture readback establishes restored readiness. Only eligible live cases establish restored observed answerability.
5. **Presentation.** MCP returns the three results independently with reason codes, revision, count units and citations. Studio renders the same response with labels, last observation and repair link. Rechecking after expiry, late arrival or revocation can change what the viewer can establish.

### Build artifact manifest

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
