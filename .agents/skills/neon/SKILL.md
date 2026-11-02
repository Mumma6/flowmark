---
name: neon
description: >-
  Inspect Flowmark's existing Neon deployment and plan Neon resource/settings
  changes through the existing Pulumi project. Use for Neon/Lakebase questions,
  branch/compute configuration or provider capabilities; use neon-postgres for
  SQL and diagnostics. Preserve existing Better Auth and local loopback setup.
metadata:
  source: https://github.com/neondatabase/agent-skills/tree/main/skills/neon
---

# Neon in Flowmark

Use [flowmark-infrastructure](../flowmark-infrastructure/SKILL.md) before any
cloud resource or persistent setting change. Flowmark already has a Neon project
and separate Production, Staging and parked Preview databases. Read the public
[ownership policy](../../../docs/infrastructure.md#pulumi-is-the-infrastructure-writer)
and [Pulumi inventory](../../../infrastructure/README.md); live IDs and operating
evidence are maintainer-local in `private/docs/infrastructure.md`.

## Infrastructure and environment ownership

All Neon infrastructure, including temporary branches, computes, database/role
resources, security settings and future services, uses `infrastructure/` Pulumi
resources. Inspect current ownership, add/import the resource first, review the
exact preview, then apply only the approved plan. A Git branch does not authorize
a cloud branch. Missing schema-only/TTL or other provider support needs a
reviewed provider/lifecycle change before provision.

Do not bootstrap another project, use Claimable as an authentication fallback,
create/change resources with CLI/MCP/REST, or apply a competing `neon.ts` config.
`packages/db/neon.ts` records a CLI policy; it is not permission for another
provisioning writer. Do not create a cloud resource and import it afterward.

Follow the [single-source env contract](../../../docs/infrastructure.md#one-source-for-environment-configuration).
Pulumi's shared inputs/resource outputs feed hosted app and CI bindings. Keep
secrets encrypted and distinct between environments. Never run generic env-pull,
link/checkout or deploy flows that replace local app `.env.local` values with
hosted credentials; local demo remains loopback. Use only the repository's
explicitly scoped, approved environment workflow when one is required.

## Inspect and operate the existing deployment

Prefer connected tools for relevant read-only inventory, schema comparison and
diagnostics. Pass the verified project and branch IDs explicitly; never rely on
the default branch for a Production operation. Use a CLI only for capabilities
not covered by the connector and keep it read-only for infrastructure inspection.
Operator login/consent is separate from permission to mutate resources. If a
session expires, reuse its documented sign-in/refresh flow; do not invent keys,
extract connector credentials or create replacement resources.

Use [neon-postgres](../neon-postgres/SKILL.md) for connections, SQL, diagnostics
and database inspection. Drizzle and the [migration workflow](../../../docs/migrations.md)
own schema/index/extension changes. Runtime data operations, restore, reset,
retention execution and test-fixture cleanup keep their separate exact-target
approval gates; Pulumi does not own application rows. Never seed Neon.

Flowmark uses its existing application-owned Better Auth. Do not enable Neon
Managed Auth, Data API, Functions, storage, AI Gateway or Realtime as a side
effect of an auth/SQL task. A new capability needs product/dependency review and
Pulumi resource support before activation.

## Provider reference

Read current official provider documentation for the capability being reviewed;
start with https://neon.com/docs/llms.txt or the connected docs search. General
provider skills/reference examples describe capabilities, not an alternate
Flowmark provisioning path. These references retain that scope:

- [Existing auth/provider boundary](references/auth.md)
- [Provider SDK capabilities](references/sdk.md)
- [Typed env reference](references/parse-env.md)
- [Read-only branch logs](references/logs-loki.md)
- [Function-trigger API reference](references/function-triggers.md)
- [Claimable reference, not a Flowmark bootstrap path](references/claimable-neon.md)
