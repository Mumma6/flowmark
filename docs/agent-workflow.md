# Working with runtime memory

Start in the repository with the human's intent. Inspect source and the deployed baseline. Use the agent connection to ask which real cases could change the decision. Record a test or a short reason when the evidence changes a patch. Label adjacent behavior and uncertainty. For an unconnected repo, continue with source and tests and state which runtime claims are unavailable. See [implemented access](implementation-status.md) and the [target tool contract](product.md#agent-interface-contract).

## Daily use

Before choosing between two plausible patches, name the production fact that would make you pick one. Start with `context_for_change` and inspect the relevant cases under your grant. If both answers lead to the same patch, skip capture. If existing evidence settles a one-off question, cite it and continue.

When the distinction matters to future changes, identify the boundary that can attest it and the closest case that could be mistaken for it. For example, a committed receipt for a different request cannot settle the original payment. Prefer fixing a missing link at an existing reporting site. Keep the reviewed question, fixture and tests in the feature PR. Exercise a positive case, its look-alike and a rollback, then check what an authorized reader actually received. The next session can repeat the check from the repository. [Question declaration and CI readback](runtime-memory.md#check-a-repository-owned-runtime-question)

| Work                | When to query                                                            | What to carry into implementation and review                                                                                                        |
| ------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| New feature         | During planning, before a new path exists                                | Adjacent behaviors, constraints suggested by real cases and unresolved product intent. Author new questions and capture fixtures.                   |
| Bug                 | Before choosing a cause or fix                                           | Failing or partial case plus a legitimate near-neighbor. Test the distinction and cite each.                                                        |
| Refactor            | Before moving or splitting source sites and again on the diff            | Representative behavior variants and stable probe IDs. Preserve or deliberately version meaning and compare the successor artifact.                 |
| Incident            | When scoping affected deployments, before remediation and after recovery | Bounded counts, known loss, handled failures, late events and last known state. A time association is a hypothesis.                                 |
| Integration change  | Before choosing correlation, retry or acknowledgment semantics           | Provider-specific attempts, fallbacks, independent receipts and idempotency scope. Surface business guarantees for human decision.                  |
| Dependency upgrade  | When an affected framework, queue or provider adapter changes            | Retrieve exercised boundaries, verify hook compatibility, overhead and emission under the new version.                                              |
| Architecture change | Before changing service, transaction, queue or ownership boundaries      | Map the cross-service cases, causal edges and missing links. Verify that returns, failures, authorization and eventual outcomes survive the change. |

## New feature from intent to observed traffic

For **self-service booking rescheduling**, the human specifies when the old slot may be released. The coding agent owns the following handoff.

| Step                     | What Flowmark contributes                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Read the plan         | Identify consequential unanswered questions. Leave product promises such as when a slot may be released with the human.                |
| 2. Inspect source        | Map booking handlers, slot ownership, message and confirmation consumers to candidate behaviors and deployed artifacts.                |
| 3. Retrieve history      | Resolve change context without a workflow name. Return matching or adjacent booking cases with provenance.                             |
| 4. Design                | Supply a normal move, redelivery, legitimate second change and delayed response when observed. Make absent cases explicit.             |
| 5. Name new questions    | Version questions about commitment, retry identity and confirmation. Start the new self-service path with zero production history.     |
| 6. Implement             | Use the cases to choose a scoped change identity and test the human's required guarantee.                                              |
| 7. Maintain observations | Reuse an outbox/worker event. Add the smallest typed observation where an unrecorded consequential fact first becomes known.           |
| 8. Test                  | Check results and capture through persisted authorized reads, including rollback, duplicate envelopes and legitimate repeated changes. |
| 9. AI review             | Verify mappings, counterexamples, field policy, independent denominators and evidence limits.                                          |
| 10. Open the PR          | Attach safe citations, the decision they influenced, capture delta and readiness. Mark live evidence pending.                          |
| 11. Human merge          | Review the normal feature PR. Request a separate decision only for policy expansion or missing intent.                                 |
| 12. Deploy               | Bind the emitted manifest to the active artifact and environment, including split traffic or rollback.                                 |
| 13. Observe              | Reconcile mature eligible changes and confirmations. Distinguish waiting, known loss, unresolved links and unsupported questions.      |
| 14. Next change          | A fresh agent retrieves the newly observed cases and verified gaps through the same interface.                                         |

## Existing application onboarding

1. The owner connects the repository and environment, selects read grants, approves field/retention/cost policy and binds secrets outside source and chat. The installation prepares a normal PR. Account consent and changes of collection authority are human decisions.
2. The agent inventories routes, handlers, registries, cron jobs, workers, queue producers/consumers, tests, external integrations, domain events and existing hooks. It compares these with independent deployed inventory and artifact identity. Show unsupported languages, dynamic/generated routes and missing deployment metadata.
3. Rank work by consequence of a wrong change, frequency of change, existing activity and unanswered questions. Exercise one vertical slice across a request, worker and downstream acknowledgment. Keep the remainder of the estate visible. Reuse authorized historical evidence only when source, semantics and population can be established.
4. Use existing domain events first. Reuse permitted OpenTelemetry or framework metadata around HTTP, jobs, databases and external APIs when it adds useful context. An agent adds semantic observations at consequential boundaries that technical hooks cannot establish. Keep details such as raw SQL and request bodies outside the default policy.
5. The installation PR includes a compact source manifest, allowlisted observation changes, an agent planning instruction, CI verification, delivery budgets and a representative case plus counterexample. A human reviews and merges once. A collector outage must preserve application results and error identity.
6. Read back evidence on a disposable test or staging run, then wait for matching deployed traffic. Flag unsupported integrations, ambiguous domain meaning and inaccessible sources explicitly. Move to the next consequential slice. Reconcile discovery and repair mappings whenever code or deployments change.

**Available path today.** Connect the repository and environment. The installation PR adds a Cursor rule that starts planning from the ticket and review from the diff, and calls `context_for_change` when retained evidence could change the decision. Expand a cited case with `explain_execution`. Other hosts keep the same repository instruction and must treat the read as unavailable. A revoked grant, a failed read and a docs-only change produce no production fact. [Repository installation](runtime-memory.md#repository-and-environment-installation-under-policy)
