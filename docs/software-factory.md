# Software Factory

Flowmark reuses its existing engineering tools and private planning system.
Pull requests get deterministic architecture/documentation regression checks in
addition to existing CI. Staging updates and weekly runs collect cross-PR
learning evidence automatically. **Hosted AI is off by maintainer choice.**
Contextual architecture review, semantic documentation audits and AI-generated
lesson proposals remain inactive; this implementation does not claim those
capabilities are running.

## Pull requests

The existing `Pull request verification` workflow runs these gates:

| Gate                  | Coverage                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Application           | Prettier, ESLint, TypeScript, unit tests and source-graph boundary tests                                           |
| Engineering guardians | Selected Effect/functional syntax, package ownership/organization, local doc links and removed documented commands |
| Native Rust           | Pinned toolchain, formatting, Clippy, tests and property tests                                                     |
| WASM / public builds  | Server production build, artifact tracing, Node 24 compatibility and affected dashboard/docs/web production builds |
| PostgreSQL            | Disposable PostgreSQL integration suites and complete-report checks                                                |

The existing required aggregate check now waits for **all four jobs**, including
integration. Guardians run inside the application job, without another install
or job. The existing WASM job also builds affected public frontends using
Turbo's graph/cache, full blobless Git history and the event base SHA; it caps
build concurrency at two. Local-only apps are not build entry points.

The guardians emit GitHub error annotations and a check summary, fail on new
confirmed deterministic regressions, and never demand a docs edit merely because
source changed. No hosted credentials are passed to PR verification.

Run `pnpm factory:check origin/staging` locally after fetching the current base.
The command inspects tracked and non-ignored untracked working files. CI passes
the PR base SHA explicitly; merge verification uses the preceding push revision.
This is a base-to-current comparison, so line shifts and existing debt do not
fail unrelated work. Counts are compared per file/rule/message: this ratchet does
not prove every pre-existing issue is resolved, or distinguish replacing an old
violation with a new one at the same count. Normal TS/unit checks and contextual
review remain necessary. `pnpm check` retains its existing full verification;
the Git-history comparison is an explicit additional local command.

AST checks follow Effect imports/aliases and reject new legacy v3 APIs. In
package `use-cases/` and `rules/`, they reject imperative loops and async functions;
in `use-cases/`, `ports/` and `rules/`, they reject direct Effect runtime execution.
Public SDK/runtime adapters, framework handlers, React and Pulumi keep their
existing boundary exceptions. This is selected explicit syntax enforcement,
not proof of idiomatic Effect, resource safety or functional correctness.

Existing source-graph tests cover runtime cycles, API/core/persistence/browser
boundaries and MCP ownership. Added checks include declared workspace imports,
public entry points (including type imports), cross-package relative imports,
and engine/persistence direction. Native Rust lint/test coverage remains the
Rust guardian. Rust module cohesion, algorithm duplication, abstractions and
cross-language contract meaning still need contextual judgment. No Go source or
module exists today; add its formatting, vet, tests/build and ownership contract
with the first actual Go responsibility instead of running an empty Go job.

Documentation checks resolve inline relative Markdown links, including deleted
targets referenced by unchanged docs, and detect references to removed root
scripts. They cover tracked Markdown/MDX/agent/skill/Cursor rule files. They skip
site routes, external URLs, fragments and code examples. Reference-style links,
MDX imports, anchor existence and semantic contradictions are outside this
check. Existing broken links are baseline debt, not a new blanket failure.

## After merge and weekly

`Engineering learning evidence` runs on every push to `staging`, plus Mondays at
07:23 UTC on the default branch. GitHub schedules require the workflow to exist
on the default branch (`main`), may be delayed by GitHub, and use that branch's
tooling revision. Staging merge runs become available when the workflow lands on
`staging`; scheduled runs follow its normal release to `main`. Nothing is live
merely because files exist in this checkout. Manual dispatch is recovery only.

The job uses Node and a read-only built-in GitHub token. It installs no project
dependencies, executes no PR code and receives no API or deployment secret.
Each run reconstructs a rolling 90-day window from GitHub history, samples the
latest 50 merged PRs targeting `staging`, and reads PR commit identities, Actions failures plus submitted
reviews/inline review comments. Release PRs into `main` are excluded to avoid
counting the same implementation twice. Up to 1,000 closed PRs and 1,000 Actions
runs are fetched, with up to 200 entries per review endpoint per sampled PR and
200 commits per sampled PR and 4,000 characters per review entry. Rate/API errors fail visibly; pagination,
sampling and text limits are explicit in partial reports. Historical deleted
runs/comments cannot be reconstructed; API history is not an indefinite archive.

Failures are grouped by workflow path across **distinct PRs**. A rerun does not
create another occurrence. Runs without PR associations are matched by exact PR
commit SHA, including earlier commits; force-pushed commits removed from the final
PR history may remain unattributed. Branch-name similarity is never used. Reviewers can attach stable policy identifiers such
as `[factory:effect-runtime]` to a confirmed finding. Plain prose is retained for
future contextual analysis but is not guessed into a category by keywords.
A signal appearing in at least three PRs generates one evidence-backed triage
proposal with source links. Repeated CI failure does not establish a common root
cause: inspect the logs before proposing a rule change.

The job writes a summary and a 90-day `engineering-learning-<run-id>` artifact
with JSON evidence and Markdown proposals. It never posts PR/issue comments,
creates GitHub Issues, sends notifications or changes repository files. With no
new qualifying recurrence, the summary simply records that result. These
artifacts are reports, not a task management system. Rolling history accumulates
across PRs without relying on a mutable cache or one previous artifact.

Human-reviewed decisions in
[decisions.json](../.github/factory/decisions.json) suppress known proposals until
their review date. Use the exact signal ID, decision, reason and expiry; keep
approved work in the existing private task roadmap. Reports may repeat an
untriaged signal until a decision is recorded. Suppression of CI workflow groups
is deliberately coarse; semantic cause-level deduplication requires contextual
review. The evidence archive preserves the underlying observations.

## Contextual review and continuous learning

Root `AGENTS.md` review guidance and the
[engineering-feedback skill](../.agents/skills/engineering-feedback/SKILL.md)
provide one shared procedure for Codex/Cursor. Reuse existing skills; do not make
parallel architecture rules for the factory. The repository is authoritative.

The [hosted activation design](../.github/factory/README.md) compares native
Codex GitHub review with Codex Action, documents credentials, costs, trust
boundaries and a future reviewed Pulumi adoption. No credentials/provider or
paid workflow were added. Automatic semantic reviews and retrospective lessons
require that separate activation. Local Codex login and Cursor installation do
not make Codex available in Actions.

Native Codex review needs a GitHub connection, repository permission and automatic
reviews enabled. A custom Codex Action installs the CLI and uses a provider API
key; it does not inherit the desktop session. Avoid running both for duplicate
feedback. [GitHub integration](https://learn.chatgpt.com/docs/third-party/github),
[Codex Action requirements](https://github.com/openai/codex-action).

Any future reviewer must treat PR patches, changed AGENTS/skills and comments as
untrusted data. A privileged workflow must never check out/build/run that code.
Keep model execution separate from feedback publishing, validate output and
current head SHA, bound input/output/request counts and leave AI advisory.
[Codex Action security](https://github.com/openai/codex-action/blob/main/docs/security.md),
[GitHub secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use).

GitHub cannot write ignored local `private/` tasks. Future hosted retrospectives
must deliver bounded proposals for an approved local importer or local Codex
process to triage. They must not silently introduce a public backlog or claim
that artifact retention is organizational memory by itself. No automatic skill,
AGENTS, architecture or product changes are permitted.

## Verification and ownership

Run `node --test scripts/*.test.mjs`, `pnpm factory:check origin/staging`, and
`pnpm format:check` for tooling changes. CI retains the full application/native/
WASM/integration coverage; there is no reason to repeat all builds weekly when
no code changed. Fixture tests exercise AST rules, documentation deletions,
command matching, recurrence, suppression and workflow privilege/gate contracts.

Workflow YAML and scripts are versioned implementation. Persistent Actions
settings, branch rules, app installations, provider credentials and secrets
remain subject to the existing [Pulumi writer policy](./infrastructure.md).
Approval to edit these files does not authorize uploading code, changing hosted
settings, enabling paid usage, deploying or publishing.
