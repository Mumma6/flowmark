---
name: pull-request
description: >-
  Prepare and create GitHub pull requests for Flowmark using the repository
  PR template. Use when the user asks to open a PR, create a pull request,
  prepare a PR description, or review branch changes before submitting.
---

# Flowmark pull requests

Create concise, professional PRs that are easy to review. Follow
[`.github/pull_request_template.md`](../../../.github/pull_request_template.md)
for every PR description. Git and Production gates live in
[`.cursor/rules/git-safety.mdc`](../../../.cursor/rules/git-safety.mdc);
creating a PR is not permission to merge or deploy.

## Before creating a PR

1. Inspect Git status and the diff against the explicit target branch: normal
   feature, fix, and infrastructure PRs target `staging`; application release
   PRs target `main` with head `staging`. Use the
   [release skill](../release/SKILL.md) for application releases.
2. Identify a related internal roadmap task when applicable.
3. Read the task file internally when useful for context.
4. Extract **task ID**, **title**, and a brief **public-safe** description
   (1–2 sentences on purpose — no confidential detail).
5. Scan for unrelated files, secrets, `.env` or credential material,
   temporary debugging code, and accidental edits.
6. **Run `pnpm check` from the repository root** before the first push for the
   PR and before `gh pr create`. This matches CI (`format:check`, lint,
   typecheck, test). If it fails, fix the failure (including
   `pnpm exec prettier --write` on touched files when format check fails) and
   re-run until it passes. Do not push or open the PR while `pnpm check` is
   red. For changes that truly cannot use the full monorepo check, run the
   narrowest equivalent and say so in **Verification** — default is always
   `pnpm check`.
7. For schema changes, follow [database rollout](../../../docs/migrations.md).
   Include generated migrations with the stack change. Separate implementation,
   feature merge readiness (Preview plus activated ordered rollout), and release
   readiness. Never require Production mutation merely to finish a feature PR.
   Record tested SHA, per-environment migration/smoke results and pending gates.
   Note infrastructure changes, Vercel or Neon impact,
   and any manual deployment steps.
8. Before reporting a PR ready to merge, inspect both CI jobs: the fast
   `Format, lint, typecheck, and test` check and `PostgreSQL integration tests`.
   Local `pnpm check` alone does not run the database suites without
   `TEST_DATABASE_URL`. Report pending or failed integration checks explicitly;
   use the [development guide](../../../docs/development.md#database-integration-tests)
   for the isolated local equivalent. CI migrations target disposable loopback
   Postgres only and do not authorize any hosted database action.

Use [`gh`](https://cli.github.com/) for GitHub operations when appropriate.

## PR description

Use the template sections in order:

| Section              | Content                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| **Summary**          | Why the change exists and what it achieves.                                    |
| **Related Task**     | Omit if none. Otherwise `**TASK-XXX — Title**` plus 1–2 public-safe sentences. |
| **Changes**          | Important behavior and architecture — not every modified file.                 |
| **Verification**     | Checks actually run, with Passed / Failed / Skipped / Not run.                 |
| **Impact & Risks**   | Breaking changes, migrations, infra, auth/security, compatibility — or `None`. |
| **Deployment Notes** | Manual steps; remember merge to `main` deploys Production — or `None`.         |

Write concise, professional English. Prioritize **why**, **what was
implemented**, meaningful technical decisions, verified checks, risks, and
deployment requirements. Do not paste long AI summaries of each file.

### Quality reference

**Title:** `fix(db): prevent unsafe local migrations`

**Summary:** Prevents local database setup from accidentally applying
migrations to a remote PostgreSQL database.

**Related Task:** **TASK-001 — Stop local setup from migrating a remote
database** — Ensures setup validates the migration target before executing
SQL.

**Changes:** Validate migration URL; regression tests; preserve local dev
workflow.

**Verification:** `pnpm check` — Passed; migration safety tests — Passed.

**Impact & Risks:** Low risk. No hosted database changes.

**Deployment Notes:** None.

## Public documentation boundary

Flowmark is public; planning and ops docs may live under `private/`. Agents
**may read** those files internally. PR descriptions **must never** include:

- Links or paths to `private/` files
- Relative links to internal task documents or roadmaps
- Confidential infrastructure details
- Secrets, credentials, tokens, or connection strings

Reference internal work by **task ID, title, and short public-safe
description only**. Do not create GitHub links to gitignored paths.

## Git workflow

Apply [git-safety.mdc](../../../.cursor/rules/git-safety.mdc) for push-to-`main`,
merge, deploy, force-push, and destructive production operations.

- Prefer feature branches and one coherent task or feature per PR.
- Fetch origin and start normal branches from current `origin/staging`.
- Always pass `--base staging --head <feature-branch>` for normal PRs;
  never rely on GitHub's default branch. Release PRs explicitly use
  `--base main --head staging`. Hotfix and synchronization exceptions follow
  [application releases](../../../docs/releases.md).
- Feature PRs use squash merges; release and synchronization PRs use merge
  commits to preserve ancestry. Merge still requires explicit approval.
- Branch names: `feat/...`, `fix/...`, `infra/...`, etc.
- Meaningful conventional commit messages on the branch.
- No unrelated work in the same PR.
- Push the feature branch and open a PR when the change is ready for review.
- Never merge or deploy unless the user explicitly approves that step.
- **Gate:** `pnpm check` must pass locally immediately before `git push -u`
  (or the final push) and `gh pr create`. Skipping this gate causes the same
  failure on the pull request workflow.

When creating a PR, gather state in parallel where useful: `git status`,
diff against base, recent commits, and whether the branch tracks remote.
Run `pnpm check` after the diff is final and before any push that precedes
`gh pr create`.

## Preview verification

For changes that affect deployed apps (`apps/web`, `apps/dashboard`,
`apps/server`, `apps/docs`, etc.):

- Inspect relevant **Vercel Preview** deployments when available; verify
  behavior, not only green builds.
- Use the isolated Neon **`preview`** branch for Preview DB testing only.
- Never run migrations or destructive database operations without explicit
  approval (see git-safety rule).
- Label verification as automated vs manual.
- If Preview cannot be tested, say so in **Verification** or **Deployment
  Notes**.

See [flowmark-vercel](../flowmark-vercel/SKILL.md) for Vercel project
conventions when needed.

## Task tracking (internal only)

When the PR maps to an internal roadmap task:

- Update verified acceptance criteria in the task file.
- Add concise implementation and verification notes.
- Keep the master roadmap status consistent.
- Do not mark a task complete while required live verification is still
  pending.

These updates stay in internal files and **must not** appear as links in
the public PR.

## Final response after creating a PR

Reply concisely with:

1. PR title and URL
2. Short summary
3. Tests and verification results
4. Preview deployment status (if applicable)
5. Manual steps required before merge (if any)
