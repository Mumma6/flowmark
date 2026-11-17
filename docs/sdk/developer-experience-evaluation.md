# SDK developer experience evaluation

This evaluation compares the published **0.3.0** SDK with the **unreleased
0.4.0 candidate** in PR #238. It does not establish that the candidate is available
on npm. Nothing was published, deployed, or changed in Signal.

## Method and limitations

Two fresh coding agents instrumented separate copies of the same independent
Next.js application. Neither inherited the implementation conversation. The
published trial could read npm packages, public documentation and the live
instrumentation guide; the candidate trial received locally packed public
packages and one candidate instrumentation guide. Neither read SDK implementation
files. Both could inspect the application they were modifying.

The app has an authenticated scheduler endpoint, concurrent external source
requests, an editor request, file persistence, partial results, application-owned
attempt counters and a standalone CLI. Scheduling and retries belong to the app.
Loopback HTTP providers simulate partial source availability and an editor that
fails on the first attempt. This tests real HTTP and process behavior, not real
provider services or hosted delivery.

The parent evaluator knew the implementation and separately verified behavior.
The candidate agent's first attempt left preparation I/O outside the workflow.
After that gap was reported, the guide gained an explicit boundary rule: start
before first process I/O and add later-known attempt metadata with
`setProperties()`. The same agent made a second pass using that revised guide.
That correction is **guide-driven follow-up**, not a second fresh blind trial.

The tracked [uninstrumented business function](../../packages/sdk/fixtures/consumer/control/briefing.ts)
and [instrumented business function](../../packages/sdk/fixtures/consumer/lib/briefing.ts)
show the complete before/after. The [cron handler](../../packages/sdk/fixtures/consumer/app/api/cron/route.ts)
and [CLI](../../packages/sdk/fixtures/consumer/scripts/generate.ts) use the same
business function with separately owned clients. The retained fixture is based on
the candidate's corrected integration. It shares the existing package-test app
to avoid a second installation/build harness.

## Observations

Counts are static callsites/import statements, not execution counts or a speed
benchmark. Required app dependencies, authentication, provider code and existing
business catches are excluded from SDK boilerplate counts.

| Measure                                       | Published 0.3.0 trial | Candidate 0.4.0, corrected pass |
| --------------------------------------------- | --------------------: | ------------------------------: |
| Runtime SDK imports                           |                     2 |                               2 |
| Type-only SDK imports                         |                     1 |                               1 |
| Client configuration calls / explicit options |                 2 / 0 |                           2 / 0 |
| Hosted environment values                     |                     2 |                               1 |
| Business instrumentation callsites            |                    12 |                               8 |
| Explicit process shutdown callsites           |                     1 |                               1 |
| Custom helper functions added                 |                     1 |                               0 |
| Added catch blocks                            |                     3 |                               1 |

The published agent read 5,441 whitespace-delimited words: the live guide (968),
Next documentation (558), npm README (1,435), public declarations (2,305), and
manifest (175). The candidate initially read one 1,055-word guide and no optional
references, README or declaration files. The revised guide was 1,090 words; the
corrected candidate therefore had **2,145 words of cumulative exposure**, not
1,055. These counts describe these attempts, not every developer's reading cost.

The published trial added an optional-telemetry helper to reconcile advice that
telemetry should never affect business with strict configuration failures. It
also needed manual terminal failure/rethrow handling and safe error mappings.
The candidate guide states the configuration policy directly and the callback
API owns unexpected terminal failures. Its only added catch handles a rejected
CLI delivery drain without changing the business exit status. Neither trial
needed runtime detection or Next exception-message matching.

The business callsite reduction is not entirely an API saving: the published
agent additionally chose a progress snapshot, a handled-error marker and another
milestone. Both integrations capture the four important operations, execution
failures, complete/partial outcomes and safe result counts. The candidate's eight
calls are `workflow`, `setProperties`, four `operation` calls, `step` and `done`.

Public material also had concrete release defects: the installed 0.3.0 README
introduced itself as 0.2.0, and the public Node guide route returned 404 during
the evaluation. Source corrections do not repair already published artifacts or
deployed pages; release verification must check them again.

## Verification

Independent runtime verification passed for both frozen integrations:

- Real Next production build without Flowmark credentials.
- CLI/control comparison: success, partial result, failed first attempt and
  successful second attempt had identical returned results and exit codes
  (`0, 0, 1, 0`).
- Authenticated cron responses followed the same sequence (`200, 200, 503, 200`);
  unauthorized requests remained rejected.
- Complete, partial and failed telemetry arrived with distinct generated run IDs
  across attempts. The business job ID remained correlation metadata.
- Rejected telemetry delivery preserved the application's successful HTTP result
  and CLI exit status while emitting diagnostics.
- The corrected candidate reported preparation I/O failure. Missing candidate
  credentials produced a visible CLI configuration failure, rather than silently
  disabling observation.

The candidate scenarios are now repeatable through
`pnpm --filter @flowmarkdev/node test:consumer`: build and pack the packages,
install them outside the workspace, compile public exports and both guide
variants, build/run Next, compare the control and instrumented CLI, and collect
actual HTTP telemetry. The same suite also exercises Server Actions,
application-owned `after()` work, transport retries, delivery failures and Node
shutdown. Unit tests cover callback return/error identity and terminal edge cases.

## Critical assessment

The first PR improved configuration, privacy, documentation and verification,
but retained manual failure/rethrow boilerplate for a normal invocation. Its
self-authored fixture was insufficient evidence of external developer ease.
The independent trial exposed both policy ambiguity and an incomplete boundary
example.

The optional workflow callback removes a real lifecycle responsibility. A normal
return requests completion; an uncaught exception records a safe generic failure
and preserves the original thrown value. Explicit `done({ outcome, result })`
still carries business meaning. Synchronous operation callbacks avoid artificial
`async` wrappers. The manual API remains useful for observations spanning several
invocations; the callback observes one invocation and never executes retries or
schedules work.

Remaining decisions are material: developers must choose process boundaries,
name stable business processes, define meaningful outcomes, and distinguish
request-owned delivery from process shutdown. Shared Next/CLI services still
accept a client dependency. Removing explicit Node shutdown would require a
separate lifecycle design, with tradeoffs around process ownership and delivery
guarantees. This evaluation does not justify hiding those decisions or adding
another wrapper API. The candidate is substantially simpler, but the published
0.3.0 experience has not changed until a separately approved release ships.
