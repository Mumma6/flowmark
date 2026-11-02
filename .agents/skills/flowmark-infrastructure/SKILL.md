---
name: flowmark-infrastructure
description: >-
  Plan, review and operate Flowmark infrastructure and persistent hosted settings
  through the existing Pulumi project. Use before cloud provisioning, resource
  changes, hosted secrets, domains/DNS, CI configuration or provider adoption.
  App deployment and SQL data/schema operations keep their dedicated workflows.
---

# Flowmark infrastructure

Read the [infrastructure writer policy](../../../docs/infrastructure.md#pulumi-is-the-infrastructure-writer),
[Pulumi project](../../../infrastructure/README.md) and
[environment contract](../../../infrastructure/environments.md). Maintainer-only
IDs and operating evidence live in `private/docs/infrastructure.md`; do not
publish them in a PR.

## Choose the owner before acting

- All cloud resources and persistent hosted configuration change through
  `infrastructure/`, including temporary branches, secrets, domains, security
  settings and CI configuration. This also applies to new services/providers.
- Provider tools/CLI/dashboard are for reads and verification, not resource or
  settings mutations. Do not provision manually and import afterward, use
  `pulumi do`, or run a competing `neon.ts` provisioning flow.
- Current externally owned/ignored properties require reviewed Pulumi adoption
  before mutation. Missing provider support is a design/adoption task, never
  permission to bypass Pulumi. Inspect ownership to avoid a second writer.
- App artifacts use the existing controlled rollout; schema/history uses
  Drizzle. Versioned app build contracts remain in `vercel.json` and scripts.
  Data changes, restore/cleanup and publication use their own approval gates.

## Centralize environment configuration

Read the [single-source env contract](../../../docs/infrastructure.md#one-source-for-environment-configuration).
Pulumi defines hosted app/CI variables and secret bindings; Vercel/GitHub are
consumers. Define each logical value once per environment and reuse shared inputs
or resource outputs across bindings. Keep different environments isolated.
Encrypted Pulumi config is the default secret input; an approved central store
may be referenced through Pulumi, never copied into a parallel catalog. App env
files remain local-only; platform/revision metadata remains platform-provided.

A new required hosted variable includes its Pulumi binding and catalog entry in
the change. Existing unadopted CI bindings and repeated per-binding inputs are
explicit consolidation work, not a reason to keep values maintained in two places.

## Prepare and execute

Use [branch](../branch/SKILL.md) for a task-specific branch from current
`origin/staging`. Reuse the existing project, stacks, provider pins and protection;
never create a parallel project/state backend to get around a failure.

Inspect existing resources before declaring them. Import existing resources
without changing their live values; declare new resources before creation.
Persist generated secrets encrypted before first use, with the exact environment
scope. Never print them, pass them as command arguments, pull hosted values into
local app env files, or extract connector credentials.

Run relevant checks and a preview of the exact reviewed source/stack. Confirm
that the plan contains only the requested operations. Obtain only missing live
approval for that plan, then use `pulumi up` with the reviewed plan. Reuse approval
for the same operation; do not infer infrastructure apply permission from an
ordinary feature/release merge. A changed plan needs renewed affected review.
Stop on unexpected updates, replacement, deletion or secret changes.

After apply, verify resource identity/scopes, full refresh-preview/preview and
relevant app behavior. Retain encrypted inputs and active gates in the normal
operator config so future runs describe the same resources. Keep IDs, secrets,
state and saved plans out of Git. Record the source, sanitized plan/result and
remaining rollout gates; create the PR with [pull-request](../pull-request/SKILL.md).

Use [flowmark-vercel](../flowmark-vercel/SKILL.md) for deployment inspection and
approved app rollout, [neon-postgres](../neon-postgres/SKILL.md) for SQL/diagnostics,
and [release](../release/SKILL.md) for application releases. Generic provider
skills and their provisioning examples do not override this repository policy.
