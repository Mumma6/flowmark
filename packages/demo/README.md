# Meridian Health synthetic telemetry

Meridian Health is a fictional healthcare integration platform. This private,
workstation-only tool creates deterministic workflow observations for exploring
Flowmark. It never performs healthcare work or sends patient notifications.
Every patient, referral, booking, clinic and integration reference is synthetic.
Only account recovery/verification uses the real transactional email system,
when a maintainer explicitly exercises those flows.

## Architecture and existing capabilities

- `src/scenarios`: providers, clinics, workflow names, bounded result declarations
  and explicit searchable business fields.
- `src/generator`: keyed SHA-256 samples, stable run/event/operation identities,
  ordered event construction and the 30-day scenario.
- `src/lifecycle`: authenticated ingestion, status and atomic seed/reset/reseed.
- `src/provisioning`: ordinary Better Auth HTTP registration/sign-in and
  project creation through the existing application use case.
- `src/environment`: workstation restrictions, independent environment-file
  comparisons, fresh read-only Neon endpoint/branch proof and Vercel deployment
  proof for account setup.
- `@flowmark/db/fixtures`: manifest verification, row locks and narrowly scoped
  deletion. SQL stays in the database package.

No SDK extension, public fixture endpoint, schema migration, hosted environment
variable, infrastructure resource or deployment is introduced. The tool builds
existing `EventEnvelopeSchema` events and submits them through
`IngestWorkflowEvents`, including ordinary project-key authorization, expectation
capability checks, lifecycle rules and the production persistence adapter.

The public ingestion contract already stores event timestamps in `started_at`
and `occurred_at`. Expectations deliberately use the database's observation
clock instead. This fixture composition supplies the existing scoped
`ExpectationObservationClock` with each event's simulated observation time.
The deployed service has no fixture clock switch. Storage receipt times
(`created_at` and receipt order) remain the genuine import times. No timestamp
is patched after insertion. The generated event chronology and durations are
historical; it does not claim that the server received these events in the past.

The fixture also supplies a transaction-scoped persistence context tied to its
actual Drizzle transaction. It reuses that transaction rather than creating
one savepoint and retaining one envelope advisory lock per event. Dataset/run
locks and globally unique event IDs still protect the import; any conflicting
disposition rolls back the whole dataset. Normal ingestion retains its existing
per-envelope transaction and advisory lock behavior. This avoids exhausting
PostgreSQL's lock table during a 28,000-event atomic import without changing
database settings or weakening the deployed ingestion path.

The direct workstation connection caches prepared SQL queries. Runs are
delivered in drained batches of sixteen, with each run's events strictly ordered.
This allows the existing driver to pipeline independent runs after preparing
their query shapes. Manifest verification reads candidate event rows in one
scoped query. These optimizations preserve the same ingestion/domain rules and
the single atomic dataset transaction.

## Fictional organizations and incidents

Northstar Care has River and Meadow clinics, Cedar Health has Grove and Hill,
and Harbor Clinics has Quay and Bay. Stable provider/clinic identifiers live
in `catalog.ts`. Atlas and Orbit provide scheduling; Aurora and Beacon provide
laboratory integrations. Northstar Referrals, Cedar Connect and Harbor Link
provide referral batches. Meridian Notify reports synthetic push dispatches.
There are no patient names, addresses, birth dates or personal identifiers.

Each logical day starts relative to the explicitly supplied reference minus
30 days. Volumes vary by clinic, sampled arrival time and weekday/weekend.

- Days 1–10: healthy baseline, low technical failure and rejection rates.
- Days 11–17: Orbit scheduling slows. Timeouts, application-owned operation
  retries, distinct retry runs and unconfirmed bookings increase. Days 14–16
  include observed Orbit outages; Beacon laboratory availability also drops
  on days 14–15.
- Days 18–23: Cedar Connect sends poorer data. Referral runs can complete
  while roughly 17–27% of records are rejected; matching also deteriorates.
- Days 24–30: recovery, with a smaller timeout tail on days 24–26. Historical
  unresolved confirmations remain. One run has no terminal observation.

Referral batches contain hundreds of records. Related patient/booking journeys
are explicitly **samples of accepted referrals**, not a fabricated exhaustive
expansion of each batch. A negative match stops its journey; no-availability
and booking conflicts complete without a delivery claim. Technical failures
omit unknown business counts. Pending bookings omit `confirmed`, rather than
reporting an invented zero. Resolved expectations retain the originally
reported pending terminal result. All results are application-reported evidence.

The fixed seed `meridian-health-2026-v1` and reference
`2026-11-03T12:00:00.000Z` produce **3,472 runs and 28,017 events**:

- `referral.ingest`: 180 runs.
- `patient.match`: 966 runs.
- `appointment.book`: 889 runs, including explicit retries and recent pending.
- `lab-results.sync`: 180 runs.
- `notification.dispatch`: 717 runs.
- `integration.health-check`: 540 runs.

The seed, reference and generator version define the logical dataset. There is
no wall-clock randomness. A different reference may change weekday volumes.
Use `demo:plan` for exact counts before approval. Expectation attention is read
as of the real current time: the recent pending expectation is pending at the
reference cutoff and naturally becomes overdue later. Old fixed windows may
fall outside the dashboard's current relative periods.

## Prepare locally

Use the repository's pinned pnpm. First inspect existing processes and ports;
one session owns a checkout's native build outputs. Reuse a running session or
use an isolated worktree. Do not run these builds alongside its watchers.

```sh
pnpm install --frozen-lockfile
pnpm --filter @flowmark/demo... build
pnpm demo:plan --reference 2026-11-03T12:00:00.000Z
pnpm test:integration
```

`test:integration` owns a unique loopback PostgreSQL Compose project with tmpfs
storage. It checks provisioning through the real auth handler, authorization,
ingestion, historic expectations, analytics/search, seed idempotency, reset,
reseed, preservation and refusal of unowned evidence. It never uses Neon,
local demo data, database volumes or real email delivery.

For interactive local exploration use the normal `dev:setup`, `infra status`,
`infra doctor`, `infra up`, and explicit `db:setup` workflow before `pnpm dev`.
The local dashboard must belong to the same checkout/database. `--env local`
proves the checkout-owned Compose identity; it is not an arbitrary PostgreSQL
URL option. Telemetry still carries the simulated application's `staging`
environment, while the destination is the proven local database.

## Account and project setup

The dedicated account is `flowmark.dev@gmail.com`, displayed as
`Meridian Health (Staging)`. Its project is `Meridian Health`. Better Auth
requires **at least eight password characters**. Choose a test password that
meets this existing policy; the CLI does not weaken it or embed a password.

Setup first looks up the account in the proven target database. An absent
account uses ordinary `/api/auth/sign-up/email`; an existing one must sign in
with its existing password. Its authenticated session must match the expected
email and existing user identity. Setup neither resets passwords nor sets
email verification. It preserves existing profiles. Repeating setup reuses
the owned project; ambiguous same-name projects cause a refusal. Saved project
identity cannot be silently replaced after a database/account change.

Read a password without terminal echo into a **non-exported** shell variable
and pipe it to standard input. For zsh, after approving the target operation:

```sh
read -rs 'meridian_password?Meridian test account password: '
printf '%s' "$meridian_password" | pnpm demo:setup \
  --env local --reference 2026-11-03T12:00:00.000Z --password-stdin
unset meridian_password
```

Do not place a literal password in that command, shell history, an environment
file, a script or documentation. Do not run with shell tracing. Repeated setup
requires the password again. A failed sign-in does not trigger password recovery.

The initial generated write key is written only to
`.meridian-health/local.key` (or `staging.key`), created exclusively with mode
`0600` inside a `0700` directory. It is never printed. Nonsecret project ID,
reference, seed and optional Neon project ID are saved in the corresponding
JSON state file. Both Git and Vercel uploads exclude this directory. Existing
key files are not overwritten. If setup fails between project commit and local
file persistence, inspect the owned project in Settings; create a separate
write key there and save it privately. The tool does not silently rotate keys
or take over existing accounts. A key missing from a previous setup cannot be
recovered from its stored hash.

### Email verification and password recovery

Sign in at `https://app.staging.flowmark.dev/sign-in`. Email verification is
optional under the existing auth policy; setup leaves it unverified. To test
delivery, use the verification action in Settings → Account, then open the
Staging-labeled message in the account inbox. Its action link must use
`app.staging.flowmark.dev`; following the real provider link verifies ownership.

For recovery, open `https://app.staging.flowmark.dev/forgot-password`, submit
the account email and follow the Staging reset link in the inbox. Complete the
normal password form, then sign in with the new password. Recovery revokes old
sessions under existing policy. These actions use the configured Staging Resend
delivery and are independent of demo seed/reset/reseed. They are never triggered
by the telemetry generator. Do not copy token-bearing links into logs or docs.

## Staging preparation and approval

Hosted operations are separate from local implementation/testing. Obtain
explicit approval for the exact environment, reviewed revision, logical
configuration and operation. A confirmation flag records the operator's choice;
it does not itself grant an agent permission. No Staging writes or actual email
tests are implied by building or merging this tool.

Use the existing read-only `neon:env-pull` workflow to prepare the three ignored
Neon environment files (`.env.neon`, `.env.neon.preview`, `.env.neon.staging`).
Do not copy them into app env files. Preserve the existing Pulumi source of
truth. The Staging source must identify `NEON_BRANCH=staging` and a direct TLS
endpoint distinct from Production and Preview. The CLI independently resolves
the endpoint's actual Staging branch via fresh read-only Neon API inventory.
Use the existing authenticated Neon CLI (version `8.16.0`);
the fixture neither installs provider tools nor reads their private credentials.
The adapter reuses installed executable code from the npm cache, or invokes
the exact pinned version with `npx --no-install` when it is already available.

Before account setup it also inspects both canonical Staging deployments with
the existing Vercel CLI (`65.9.0`), scoped to `mumma6s-projects`. Both must be READY,
non-Production, from `staging`, at the same commit, in `flowmark-dashboard` and
`flowmark-api`. Existing deployed auth/database isolation guards still apply.
No provider configuration is changed by these reads. Unavailable or unexpected
provider metadata fails closed and must be investigated, not bypassed.

Unset exported database, migration, test, local demo, API and auth-origin
overrides first. Hosted runtimes, Production and Preview are rejected. The
workstation CLI reads only the guarded files, checks live provider identity,
and verifies database/user identity after connecting. It never runs migrations.

After separate approval, use the nonsecret existing Neon project ID from
the Pulumi operating record:

```sh
read -rs 'meridian_password?Meridian Staging account password: '
printf '%s' "$meridian_password" | pnpm demo:setup \
  --env staging --reference 2026-11-03T12:00:00.000Z \
  --neon-project <existing-project-id> --password-stdin --confirm-staging-setup
unset meridian_password
```

The exact fixed reference above is useful for repeatable review. For an active
Staging demo, choose and review a reference near the intended import time.
Setup does not seed telemetry. Do not use `db:seed` against Neon.

## Dataset commands

Commands use saved configuration and the private write key; they revalidate the
target each time. Staging confirmations are deliberately separate:

```sh
pnpm demo:status --env staging
pnpm demo:seed --env staging --confirm-staging-seed
pnpm demo:reset --env staging --confirm-staging-reset
pnpm demo:reseed --env staging --confirm-staging-reset --confirm-staging-seed
```

The equivalent local seed/status commands need only `--env local`. Local reset
and reseed require `--confirm-local-reset`. Seed is transactional and repeating
it with the same configuration leaves the same logical dataset. Reset is
idempotent; reseed performs verified reset plus regeneration in one transaction.
Nothing runs automatically during builds, deployments or application startup.

To move the window or change the seed, reset with the **original** saved
configuration first, inspect status to confirm zero owned runs, then edit only
`config.reference`/`config.seed` in the nonsecret state file and review a new
plan before seeding. Reusing a changed configuration against existing data fails
closed rather than accumulating another window. Keep the original configuration
until cleanup succeeds. A generator-version change needs review of ownership
compatibility; retain the previous revision for its reset operation.

## Reset ownership and preservation

Project identity alone never authorizes deletion. Within an advisory-locked
transaction, the fixture locks candidate run rows and verifies:

1. A valid write key belongs to the explicitly saved project, owned by the
   expected authenticated account.
2. The run's exact workflow/external identity exists in the manifest, with the
   matching dataset/configuration hash, context, start time and relationships.
3. Every stored event has a planned stable event ID and exactly the intended
   stored payload, including timestamps, operation identity, duration, results
   and expectation evidence.

Unknown run identity, changed configuration, changed context or an extra/changed
event aborts the transaction. Appenders use the same run-row locks, so evidence
cannot be added between verification and deletion. Reset deletes only verified
raw events/runs and their same-lifetime cascading projections. It retains users,
auth records, sessions, verification records, workspaces, projects, ownership,
keys, workflow definitions and result/search configuration. Manual telemetry
in the same project and all other projects remain untouched. A manual event
attached to a demo run causes refusal, not deletion of that event.

No whole-table truncation, project-wide telemetry delete, account deletion,
retention cleanup, volume reset or force-cleanup option exists here. If evidence
has changed, inspect it and make a separately reviewed maintenance plan.

After schema migrations, rebuild the native packages and run disposable tests
before any hosted refresh. Check that the fixture's persisted-field comparison
matches the new schema. Reset/reseed with the original manifest and reviewed
code only after approval; do not patch timestamps, edit applied migrations or
discard ownership evidence to make a seed succeed.

## Dashboard walkthrough and limits

- **Overview / Workflows:** six names, daily volume variation, technical
  completion, latency and failure history. Select a period covering the saved
  window; a fixed old reference does not imply recent activity forever.
- **Runs:** inspect `SYN-BOOK-RECENT` for a technically completed booking with
  a pending business result. Patient journeys carry `SYN-REF-*`, `SYN-PATIENT-*`,
  `SYN-BOOK-*` and shared batch references. Operations, progress, intermediate
  reports, explicit parent links, operation attempts and qualified run retries
  use existing contracts. The terminal-less Harbor Bay case is last-reported
  incomplete evidence, not proof of activity/failure.
- **Insights:** choose `referral.ingest`, declaration `meridian-v1`, and compare
  `rejected` with `received`; filter the configured `provider=cedar-health`
  dimension. Choose `appointment.book` to inspect confirmation counts and
  missing fields alongside slower Orbit requests. Result declarations enable
  existing aggregation; unknown failed/pending counts remain absent.
- **Expectations:** pending, overdue, met-on-time and met-late acknowledgments
  use the real expectation read model. A delayed settlement does not rewrite a
  run's terminal result. Attention depends on the current observation time.
- **Issues:** recurring `SCHEDULER_TIMEOUT`, `SCHEDULER_UNAVAILABLE`,
  `LAB_INTEGRATION_UNAVAILABLE` and notification errors supply supporting runs.
  Existing issue highlights depend on selected relative comparison windows
  and thresholds. Recovery can legitimately show no increase. Rejection rates
  are business evidence in Insights, not a fabricated automatic issue detector.
- **Global Search:** workflow names and run IDs use current search behavior.
  Exact configured lookup values (for example `SYN-BOOK-RECENT`) and allowed
  provider, clinic and integration dimension values are searchable. This does
  not add arbitrary JSON, patient-name, substring-reference or causal search.

## Extending scenarios

Keep logical keys stable within a dataset version, preserve dependent event
ordering and use existing core schemas. Add bounded result declarations and
search permissions deliberately. Document new patterns and update deterministic,
isolation and analytics assertions. A new public SDK contract, telemetry/schema
migration or significant scope expansion still needs the repository's separate
design and rollout workflow.

Hosted account/email, seed, reset and Staging dashboard verification remain
separate approval-gated operations. Local tests are not end-to-end Staging proof.
