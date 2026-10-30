---
name: feature-roadmap
description: Plan and execute substantial features, refactors, and infrastructure work using one concise master roadmap and one Markdown file per independently implementable task. Use when the user wants to plan a feature, break a project into tasks, refine a backlog, or implement one task from an existing feature roadmap. Avoid creating a roadmap for trivial fixes unless requested.
---

# Feature Roadmap — plan once, implement incrementally

Build high-quality software using a **master plan + small, independently executable task files**. Optimize for clarity, technical quality, minimal repeated agent context, and reviewable changes. The agent may make sound implementation and architecture decisions; the human owns product intent, significant tradeoffs, cost, and final acceptance.

## When to use

Use for meaningful new product features, multi-step refactors, substantial integrations, infrastructure changes, and existing roadmap maintenance. Do **not** force a plan on a one-file fix or a simple question. When the user asks only to plan, create or revise planning files **without implementing**. When the user selects a task for implementation, execute **only that task**.

## Plan location and structure

For a new initiative, use the repository's existing planning conventions where present. Otherwise default to:

```text
private/plans/<feature-slug>/
  ROADMAP.md
  tasks/
    TASK-001-descriptive-slug.md
    TASK-002-descriptive-slug.md
```

If the repository does not use `private/`, choose an appropriate tracked planning location. Do not assume `private/` is committed; check whether it is ignored. Respect the user's privacy/publication preference. For work in an existing roadmap, **keep its current paths, filenames, IDs, and status** instead of moving files. Do not create a second competing backlog.

## Workflow A — create or refine a roadmap

1. **Understand the outcome.** Determine what the user wants to achieve, why it matters, and what is out of scope. Ask only if a missing answer would materially change the architecture; otherwise make and state reasonable assumptions.
2. **Inspect selectively.** Read existing docs, relevant application boundaries, tests, and config. Reuse verified findings. Distinguish observed facts from assumptions and cloud state that requires live verification. Never repeat a whole-repo audit just because a roadmap already exists.
3. **Design for the product.** Evaluate relevant options, tradeoffs, security, costs, dependencies, backward compatibility, and operational complexity. Prefer existing patterns and simple maintainable designs; do not preserve a flawed approach merely because it exists.
4. **Create a short master roadmap.** Include the goal, architecture decisions, non-goals, current state, target behavior, prioritized linked task index, dependencies, approval boundaries, and definition of done. This file is the **single source of truth for task status**.
5. **Split into outcome-based tasks.** Each task should produce a concrete, verifiable improvement and fit into a focused, reviewable agent run. A large risky task can contain explicit phases or be split into smaller tasks. Do not set an arbitrary number of tasks; avoid both micro-tickets and giant one-shot implementation requests.
6. **Validate the plan.** Check for missing requirements, broken links, task overlaps, circular dependencies, accidental scope creep, and tasks that cannot be verified. Preserve prior completion status and verified evidence when restructuring an existing plan.
7. **Stop.** Summarize the recommended starting task, noteworthy decisions, and unresolved risks. Do not implement unless explicitly asked.

### Master roadmap contract

Keep `ROADMAP.md` scannable. Include:

- Objective, user-visible outcome, and non-goals.
- Current state and evidence; verified issues vs hypotheses.
- Target design and key decisions (briefly, with links to existing ADRs).
- Linked task table with ID, concise title, priority, dependencies, AI effort, and **one overall status** per task (`[ ]`, `[~]`, `[x]`).
- Recommended execution order (based on safety and dependencies, not alphabetical order).
- Shared constraints and approval gates.
- Definition of done.

Prefer a compact summary over duplicated task details. A roadmap is a navigation surface, not an architectural textbook.

### Task file contract

Each task file contains:

```markdown
# TASK-XXX — Clear outcome-oriented title

[Back to roadmap](../ROADMAP.md)

**Priority:** P0 / P1 / P2 / P3
**AI effort:** Low / Medium / High
**Risk:** Low / Medium / High
**Execution:** Autonomous / Review required / Approval for live changes

## Outcome

What will be measurably different when complete?

## Context and evidence

Relevant files, current behavior, confirmed gaps, and important unknowns.

## Implementation scope

Required behaviors and constraints; allow the agent to choose sensible internals.

## Out of scope

Adjacent work explicitly excluded.

## Acceptance criteria

- [ ] Concrete, verifiable requirement
- [ ] Automated verification where appropriate
- [ ] Live or manual verification if needed

## Dependencies

Relative links to required predecessor tasks, or None.

## Verification

Commands, tests, or observations that prove the result.

## Safety and approval

Only task-specific risks and approval gates.

## Completion notes

Implementation decisions, verified results, and unfinished manual steps.
```

Task files **do not duplicate overall status**. Keep acceptance checkboxes there, and overall task status only in the master roadmap. Use relative links that resolve.

## Workflow B — implement one task

1. Read the selected task and the roadmap's shared constraints. Read only direct prerequisite task notes and source files needed for the implementation. Do not load every other task.
2. Confirm the selected task's outcome, current state, and approval boundaries. If the task is high-risk or architecturally uncertain, make a short scoped design first; otherwise proceed.
3. Implement the smallest complete change that meets its acceptance criteria. Follow established project conventions; improve poor designs when they fall within scope. Avoid unrelated cleanup, new frameworks without a concrete gain, and broad rewrites.
4. Add focused tests and run relevant checks. Never claim that a test, deployment, or live validation passed unless it actually ran and passed.
5. Stop before approval-gated operations. Examples: production deploys or migrations, destructive commands, cloud resource deletion/replacement, DNS or secret changes, publishing packages, customer-data changes, or recurring costs. Prepare the change and describe exact human steps instead.
6. Update the selected task's acceptance checkboxes and completion notes with **observed** outcomes. Update the main roadmap's overall status: `[x]` only when all required criteria are accepted; `[~]` when code is ready but a live gate remains.

   For repositories with separate deployment environments, distinguish completed
   implementation from feature merge and production release gates. Follow the
   repository rollout guide; do not require Production mutation merely to accept a
   feature implementation. Record pending rollout in completion notes and release
   tracking. Keep [~] only for work required by the task's current acceptance gate.

7. Summarize the changed files, tests and results, decisions, outstanding risks, and next task. Do not start the next task automatically.

## AI effort and context discipline

- **Low:** Narrow scripts, unit tests, docs, small fixes — fast/cheap coding model.
- **Medium:** Bounded feature work, CI, integration, focused refactors — standard capable coding model.
- **High:** Significant architecture, security, multi-service integration, IaC imports — strong reasoning for the difficult decisions; then bounded implementation.
- Prefer one fresh agent chat per task; pass only that task's path and relevant files.
- Do not re-scan all of the repository, regenerate the roadmap, or request maximum reasoning for every task.
- Separate repository implementation from live rollout and verification.
- Optimize **total rework and quality**, not merely the lowest possible token count.

## Quality rules

- Preserve compatibility unless a breaking change is deliberate and documented.
- Use typed boundaries, explicit errors, safe defaults, and meaningful tests.
- Prefer existing libraries, patterns, and tools; justify additional dependencies.
- Respect security and data-isolation boundaries; never expose secrets in task files, logs, or chat.
- Make only source-grounded claims; label external state as unverified until read back.
- Keep the plan adaptable: split, merge, defer, or remove tasks when evidence warrants it, while preserving history and a single status source.

## Useful invocation patterns

Planning: `Use /feature-roadmap to plan <feature>. Create the roadmap and task files only; do not implement.`

Execution: `Use /feature-roadmap to implement TASK-XXX from <path-to-task>. Stay within scope, test, update task and roadmap status, and stop before live changes requiring approval.`

Refinement: `Use /feature-roadmap to refine the existing <roadmap-path> without changing application code. Preserve progress and IDs.`
