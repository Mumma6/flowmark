# Engineering feedback policy

The operating guide is [Software Factory](../../docs/software-factory.md).
Architecture rules remain in the existing skills/ADRs. This folder owns only
feedback suppression decisions and the future hosted integration contract.

`decisions.json` starts empty. A reviewed decision has these fields:

```json
{
  "id": "review:effect-runtime",
  "status": "deferred",
  "reason": "Confirmed and tracked as TASK-001; revisit after implementation",
  "until": "2027-01-01"
}
```

Use the exact report ID. `accepted`, `deferred` and `rejected` all suppress the
same proposal until its review date. The reason explains the decision; private
task IDs/titles are enough. Never publish private task paths or private planning
content. A decision does not alter a coding rule. Expiry allows verification of
whether the problem actually stopped recurring. Removing a decision requires
review like any other repository change.

## Future hosted AI contract — inactive

The maintainer chose to keep hosted AI off on 2026-11-16. There is no AI job,
API key, new provider, recurring paid invocation or automatic posting in this
implementation. Do not turn an evidence run into a claim of semantic review.

A future change should implement one bounded contextual reviewer, not separate
agents for every checklist. Its trusted prompt must load root/nested instructions
and applicable existing skills from the reviewed base. Review changed ownership
boundaries and relevant docs; no whole-repository audit on every PR. Use
architecture-review for judgments, not to redefine rules.

Treat PR patches, titles, comments and changed instruction files as untrusted
data. Never execute PR code with credentials, install PR dependencies, load PR
hooks/configuration, check out a PR-controlled workflow, or let changed AGENTS
instructions override the trusted review policy. Fetch content through a
read-only collector. Isolate model execution from publishing and credentials.
A tool-free structured model call is the smallest trust surface; Codex Action
requires an independently verified command/network sandbox as well as its
credential proxy. Read-only filesystem access alone is insufficient.

Use a default-branch trusted workflow after ordinary PR verification, validate
repository/event/head SHA, skip stale revisions, and publish through a separate
least-privilege job only after schema validation. If using `workflow_run`, never
execute a downloaded PR artifact, restore an untrusted executable cache or trust
an artifact's proposed target PR. Derive targets from GitHub's authenticated run
metadata and verify them through the API. Do not use `pull_request_target` to
execute PR code. Forks must never gain a paid credential through changed source.

The output contract should be one JSON result with findings containing:
`id`, `category` (architecture/documentation), `file`, `line`, `ruleSource`,
`evidence`, `impact`, `suggestedChange`, and `confidence`. Require real source
locations and a genuine inconsistency. A changed source file without a docs edit
is not a finding. Empty findings are valid. Group one comment per PR, update it
by head SHA, and publish no "all clear" comment. Never use AI as the required gate.

After merge, use the same bounded reviewer on learning evidence plus previously
accepted/rejected proposals. Output proposals with stable cause IDs, distinct PR
evidence links, affected existing instruction/skill, a minimal proposed edit,
expected benefit, and a verification method. Three independent PRs normally
justify a recurring-pattern proposal; one serious evidence-backed defect may
justify immediate review. Never infer a common coding mistake solely from a CI
failure category. Keep snapshots/decisions, not just the latest PR's narrative.
Write proposals into the existing private task system only through an approved
local process: hosted Actions cannot access ignored `private/`. Do not replace
it with GitHub Issues or a new tracker. Never automatically edit rules/skills.

## Activation checklist for a future approved change

1. Recheck official docs and actual organization access. Compare native Codex
   GitHub review against a custom action; avoid paying for both. Native review
   needs a GitHub connection, repository access and automatic reviews enabled.
   It does not supply the retrospective/private task workflow by itself.
2. Custom Actions do not inherit the local Codex login. `openai/codex-action`
   installs Codex and requires a provider API key. Review/pin its action and CLI
   versions plus security behavior. API usage and runner time have their own
   costs; do not assume a ChatGPT subscription pays for them.
3. Discuss provider adoption before adding the official Pulumi GitHub provider
   to the existing infrastructure project. Inventory existing settings; adopt
   affected bindings without changing active values. Add a dedicated encrypted
   API input, its GitHub secret binding and an off-by-default enable flag, model
   and input/output/request limits to the environment catalog. No dashboard/CLI
   mutation followed by reconciliation.
4. Select an allowed model, restrict its project/key, estimate cost from measured
   input/output at current pricing, and set a monthly operator budget. Budget
   alerts are not a hard spending cap. Enforce per-run request/token/time limits,
   skip drafts/docs-only changes when contextual review adds no value, and cap
   scheduled reviews. Define failure and rate-limit behavior; errors must be
   visible in check summaries without blocking deterministic verification.
5. Review the exact Pulumi preview, cost estimate, permissions and revision;
   obtain approval before applying or enabling paid usage. Prove fork injection,
   changed AGENTS, malformed output, stale SHA, retry deduplication, failure and
   secret isolation with fixtures before a live trusted-PR test.
6. Only then enable PR contextual review and post-merge analysis. After a week,
   inspect useful findings per dollar and repetition; disable low-value reviews.

Sources checked 2026-11-16:
[Codex Action](https://github.com/openai/codex-action),
[action security](https://github.com/openai/codex-action/blob/main/docs/security.md),
[GitHub integration](https://learn.chatgpt.com/docs/third-party/github),
[Codex pricing](https://developers.openai.com/codex/pricing),
[GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use).
