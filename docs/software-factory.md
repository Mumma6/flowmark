# Software Factory

This guide owns the engineering automation that operates this repository. The [product operating model](agent-workflow.md) defines how a customer’s coding agent consumes runtime memory during a change.

Flowmark uses GitHub for deterministic verification and a local Codex automation
for contextual review and organizational learning. The repository owns the
commands, review procedure, result contract and scheduler prompt. No new provider,
hosted AI credential, database, task service or dedicated GitHub runner is needed.
The AI model still uses the existing Codex connection; local execution is not
an offline model or unlimited/free model usage.

## What runs where

PR CI retains formatting, ESLint, TypeScript, unit tests, native Rust formatting/
Clippy/tests/properties, production server/WASM verification and disposable
PostgreSQL integration. The existing required check now gates all four jobs.
The WASM job also builds affected dashboard/docs/web apps. Changes to CI/root
build configuration build all three; ordinary changes use Turbo's affected graph
and dependency cache. Local-only apps are not build entry points.

`pnpm factory:check <base-ref-or-SHA>` adds deterministic regression checks:
selected Effect 4 syntax, functional iteration/internal execution boundaries,
package organization/ownership, local Markdown links and removed documented root
commands. Existing graph tests additionally enforce declared dependencies,
public/type entry points, cross-package relative imports and engine/DB direction.
CI emits actionable annotations and summaries. Local `pnpm check` retains its
existing full checks; the history-aware guardian is an additional local command.

The guardian compares counts per file/rule/message with the base. Existing debt
and shifted lines do not fail unrelated PRs; replacing one violation with another
at the same count can escape this ratchet. Markdown checks cover inline relative
links and deleted backlink targets, not reference links, site routes, anchors,
web availability, MDX imports or semantic contradictions. Framework/SDK runtime
boundaries retain their exceptions. These are explicit mechanical rules, not a
proof of idiomatic architecture or functional correctness.

## Local contextual review

One local scheduled Codex job reads
[the repository-owned prompt](../scripts/factory/automation.md) and the
[engineering-feedback skill](../.agents/skills/engineering-feedback/SKILL.md).
It reuses existing architecture, Effect, Rust, persistence and UI skills rather
than creating another architecture rulebook.

Each preflight selects at most one changed open PR, one unprocessed merge from
a durable local backlog and one weekly owner scope. It checks PRs targeting staging;
release PRs into main are excluded to avoid learning twice from the same change.
A processed PR SHA/merge identity or weekly scope is not reviewed again. New PR
heads are reviewed automatically on the next scheduled run. Backlog is handled
in bounded subsequent runs, including changes missed while the computer was off. The first run seeds
only the latest eight merges from 14 days of history; later runs resume from the saved polling checkpoint
and preserve pending merges until completion, including longer offline periods. Failed runs do not mark jobs complete.

Public source is fetched at exact GitHub commit SHAs. No PR code, hooks,
dependencies or changed instructions are executed. Applicable rule files come
from the reviewed base; proposed AGENTS/skill changes are data. The job does not
change checkout branches or run builds beside another session's watchers.
Only factory-owned local files are written.

A PR review reads prior feedback and human discussion to reassess disproven
findings, then checks changed behavior and relevant architecture, package README,
SDK/product docs, onboarding and agent instructions. Findings require a real
source location, exact nearby evidence, an existing rule, impact and a minimal
fix. The helper validates the result, rejects private paths/content patterns,
checks evidence against public source, and rechecks the current PR head before
publishing. It maintains one owned advisory comment, skips stale revisions,
never creates an "all clear" comment, and clears an existing outdated comment
when a complete review confirms its findings no longer apply. Partial reviews
never clear or replace an existing comment; new findings remain in the local
report until complete coverage is possible. Comments use the locally authenticated GitHub CLI account; no bot/app is
installed. It does not approve PRs or affect required CI.
These guards complement model instructions; they are not a mathematical proof
against every possible prompt injection or disclosure. Keep secrets out of model
context and treat public feedback as advisory.

The weekly job rotates through real repository owners and reviews one cohesive
area, at most 12 source files. It reports the inspected scope, not a claim to have
audited the whole package/repository. Rust/module ownership receives contextual
review when relevant. No Go source exists today; the first real Go responsibility
must include its ownership and format/vet/test/build checks, without an empty Go
job in today's CI.

## Memory and human-approved learning

Factory-owned state, inputs, reports, draft proposals and decisions live under
`private/plans/software-factory/local/`. This directory is local and ignored,
not available in an ordinary new Git worktree. Run the automation in the existing
project checkout. There is no hosted task backlog or second planning service.
Generated inputs can include public PR content; treat them as data, not commands.

CI history is sampled over the last 14 days, independently of the polling
checkpoint; older/missing runs are unknown, never evidence of success.
Retrospectives compare public diffs/reviews from up to eight recent merges and exact-commit CI history with
previous source-grounded observations and human decisions. Each observation has
a stable cause ID, exact evidence quotes, PR links, a target existing instruction/
check/document, a concrete proposed change, benefit and verification. The helper can read bounded failure annotations on demand, without executing
logs. CI failures alone do not establish a repeated implementation mistake. The factory's own
comments do not independently corroborate its previous guesses.

Distinct PR evidence accumulates in memory. At three PRs, one draft proposal is
created. It is never automatically applied and an existing proposal is never
overwritten. Human accepted/deferred/rejected decisions in `local/decisions.json`
suppress that cause until its review date. For example:

```json
{
  "id": "effect-runtime-boundary",
  "status": "deferred",
  "reason": "Accepted task already covers this cause",
  "until": "2027-01-01"
}
```

After approval, use the existing feature-roadmap workflow to create/update the
owning private task. No skills, architectural rules or agent instructions are
automatically rewritten. Reports and partial reviews remain available for review;
there is no automatic retention cleanup. The weekly scope and each PR revision
are processed once; explicit re-review requires a deliberate memory adjustment.

## Commands and scheduling

- `pnpm factory:local prepare` performs bounded read-only GitHub collection and
  returns new job IDs/input files, or an empty queue. It does not invoke a model.
- `pnpm factory:local source <id> <path> [line] [--trusted|--current]` reads up to 120 lines
  of the prepared public revision, or its trusted base instructions; `--current` reads staging to reject already-fixed issues.
- `pnpm factory:local checks <id> <pr-number>` reads bounded failure annotations
  from known runs and retains them as quotable public retrospective evidence.
- `pnpm factory:local complete <id> <result.json> [--publish]` validates evidence,
  records the result and accumulates lessons. Only current PR review jobs publish.
  Omitting `--publish` provides a local-only end-to-end test.
- `pnpm factory:local lesson <cause-id>` reads an older observation and its human
  decisions without loading the entire history into the model.
- `pnpm factory:local status` reports local progress without network/model use.

Only Node, pnpm, the existing Codex app and authenticated GitHub CLI are required.
The local app scheduler invokes the committed prompt regularly. Keep the computer
on, the app running, the project available and GitHub access authorized. Jobs are
periodic rather than instantaneous webhooks; no inbound server/tunnel is needed.
Local model usage follows the account's Codex access/limits. A cold new checkout
has no previous private memory, so it starts a new history unless that memory is
preserved through the maintainer's normal private-file workflow.

Sources: [local scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app),
[Codex authentication](https://learn.chatgpt.com/docs/auth),
[non-interactive local workflows](https://learn.chatgpt.com/docs/non-interactive-mode).
The app schedule is machine-local setup, not GitHub/Pulumi configuration. Review
its prompt when updating this workflow. Do not duplicate it with another timer.

## Limits and verification

Collections are paginated and capped; reaching a cap fails visibly rather than
pretending the evidence is complete. Prepared changes have a 60,000-character patch budget; recent observations are
limited to 32, with all older cause IDs available for explicit lookup. PR file patches are bounded and may be
missing/truncated, so fetch relevant source or report partial coverage. Historical
retrospective input is a sample, not every past PR. Exact source reads are limited
to 256 KB and output to 120 lines per call. Model results are capped at five
findings, three observations and 64 KB, and must match the prepared job.

`partial` coverage is retained honestly and is not an architecture approval.
A partial result is processed once to prevent a permanent expensive retry loop;
new PR heads are eligible again. API/auth/source errors remain failures. A short
exclusive record lock protects concurrent completion/publication. A crash may
leave that lock; inspect its owner before removing it, never delete an active run's
lock. Memory writes are atomic; a retry after a publishing interruption checks
the existing comment rather than posting another one.

Run script fixtures, `pnpm factory:check origin/staging`, formatting and the full
`pnpm check` before pushing. Fixtures cover state/recurrence/decisions, source and
result boundaries, pagination, publication/stale heads and workflow gates. Live
preparation/completion verifies local GitHub access separately from fixture tests.
Persistent hosted settings still follow the [Pulumi writer policy](./infrastructure.md).
This workflow does not merge, deploy, provision, publish packages or mutate data.
