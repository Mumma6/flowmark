---
name: branch
description: >-
  Create or verify a Git task branch safely in Flowmark. Use before starting
  implementation on a new feature, fix, refactor, docs change, chore, or test
  improvement — or when the user asks to start work on a task and the correct
  branch base or name is unclear.
---

# Flowmark branch management

Prepare a **safe, correctly based** local branch before implementation.
Branch creation is separate from coding, commits, push, and PRs. Apply
[Git safety](../../../.cursor/rules/git-safety.mdc) for merge, push-to-`main`,
deploy, force-push, and destructive operations.

Normal development flow:

```text
origin/staging → task branch → PR into staging (pull-request skill)
```

Production releases use long-lived `staging` and a release PR into `main` —
see [release](../release/SKILL.md). **Do not** create release branches or merge
into `main` with this skill.

## When to use

- Starting implementation on a new task, bug fix, refactor, or docs change.
- After [feature-roadmap](../feature-roadmap/SKILL.md) selects a task for
  implementation (branch first, then code).
- When unsure whether the current checkout is the right branch or base.
- When the user asks to create or switch to a task branch.

Do **not** use this skill to open PRs, push, merge, release, or rewrite shared
history — use [pull-request](../pull-request/SKILL.md) and [release](../release/SKILL.md)
when those steps are requested and approved.

## Branch naming

Use lowercase, descriptive names:

```text
<type>/<short-description>
```

| Type        | Use for                                         |
| ----------- | ----------------------------------------------- |
| `feat/`     | New features or product capabilities            |
| `fix/`      | Bug fixes                                       |
| `refactor/` | Internal restructuring without behavior changes |
| `docs/`     | Documentation changes                           |
| `chore/`    | Maintenance, tooling, configuration             |
| `test/`     | Test-only improvements                          |

Examples:

- `feat/sdk-business-outcomes`
- `feat/team-invitations`
- `fix/workflow-terminal-state`
- `refactor/sdk-workflow-engine`
- `docs/sdk-usage-examples`
- `chore/pulumi-infrastructure`
- `test/sdk-event-delivery`

Keep names concise and meaningful. Avoid generic names such as `feature`,
`updates`, `fixes`, or `task-1`.

When work maps to an internal roadmap task, include the task identifier in the
slug when it helps traceability (for example `feat/task-011-sdk-outcomes`).
Task IDs may repeat across roadmaps — prefer a short descriptive suffix too.

Infrastructure-only work may use `chore/` (or an existing remote branch named
`infra/...` from earlier work). Do not introduce new `codex/` prefixes.

Suggest a name from the task title or user request; confirm if ambiguous.

## Base branch policy

**All normal development branches must start from the latest `origin/staging`,
never from `main`.**

Do not assume the local `staging` branch is current. Do not create a task branch
from the current checkout until its merge-base with `origin/staging` is verified
or you create explicitly from `origin/staging`.

Release, hotfix, and synchronization branches follow
[application releases](../../../docs/releases.md) — not this skill.

## Workflow — create or verify a branch

Run inspection steps in parallel when useful.

### 1. Inspect state

- `git status` — staged, unstaged, and untracked changes.
- Current branch name and upstream tracking, if any.
- Whether the current branch already matches the intended task (reuse it).

### 2. Protect existing work

If the working tree is not clean:

- List what is changed; do **not** assume it belongs to the new task.
- Do **not** discard, reset, stash, force checkout, overwrite files, or rebase
  without explicit user approval.
- If switching branches would affect uncommitted work, **stop and ask**.

Never silently: discard changes, reset, stash, force checkout, delete branches,
force-push, rebase published work, or change the default branch.

### 3. Check for an existing branch

Before creating a new name:

- Search local and remote branches for the same or an obviously equivalent task
  branch (`git branch`, `git branch -r`, or `git branch -a`).
- If already on the correct branch for this task, **reuse it** and report that.
- If a matching branch exists elsewhere, check it out only when the working tree
  is clean and the user has not indicated otherwise — do not overwrite or rename
  branches silently.
- Avoid duplicate branches for the same task.

If the current branch is a feature branch with uncommitted work for a **different**
task, preserve it and ask before switching.

### 4. Verify `staging` and fetch

1. Confirm `staging` exists on the remote (`git ls-remote --heads origin staging`).
2. `git fetch origin` (and tags only if needed for another skill — not required here).
3. Confirm `origin/staging` is available after fetch.

If `origin/staging` is missing or fetch fails, stop and report — do not guess a base.

### 5. Create the branch (clean tree only)

When the working tree is clean and a new branch is needed:

```bash
git fetch origin
git switch -c <type>/<short-description> --track origin/staging
```

Or equivalent: create from `origin/staging` without checking out stale local
`staging` first.

After creation, report:

- Branch name
- Base (`origin/staging` at fetch time)
- That the tree was clean (or that reuse occurred)

Switch to a newly created branch autonomously when the tree was clean and base
was verified. Do not push.

### 6. Stop here

Implementation, commits, `pnpm check`, push, and PR creation are out of scope.
After the branch is ready, continue the task; use [pull-request](../pull-request/SKILL.md)
when the change is ready for review.

## Agent autonomy

**May do without asking** (when safe):

- Inspect Git status, branches, and remotes
- Fetch from `origin`
- Suggest a branch name
- Create a new local branch from verified `origin/staging` when the working tree
  is clean
- Switch to that newly created branch

**Must not do autonomously:**

- Push branches (including first push with `-u`)
- Merge pull requests
- Push to `staging` or `main`
- Delete or reset branches
- Rebase branches that contain work
- Deploy or run production operations

Pushing and opening PRs require the pull-request workflow and explicit user
intent; merge and deploy require explicit approval per git-safety.

## Integration with other skills

Typical sequence:

1. Read the assigned task ([feature-roadmap](../feature-roadmap/SKILL.md) when applicable).
2. **Apply this skill** — create or verify the task branch from `origin/staging`.
3. Implement within scope; run relevant checks.
4. When ready for review, apply [pull-request](../pull-request/SKILL.md) targeting
   `staging`.
5. Application releases stay on [release](../release/SKILL.md) — no release branch
   from this skill.

## Useful invocation patterns

New work: `Use the branch skill for feat/<slug> before implementing.`

Roadmap task: `Use the branch skill, then implement TASK-XXX from <task-path>.`

Verify only: `Use the branch skill to confirm I'm on the right branch for <task>.`

## Final response after branching

Reply concisely with:

1. Branch name (new, reused, or blocked)
2. Base commit reference (`origin/staging` after fetch)
3. Working tree status (clean, or blocked pending user decision)
4. Next step (implement, or ask user about existing changes before switch)
