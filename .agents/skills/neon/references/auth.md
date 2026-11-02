# Auth

Flowmark uses the [Pulumi infrastructure policy](../../flowmark-infrastructure/SKILL.md).
Provisioning examples here are upstream reference, not commands to run against
Flowmark. Add/adopt provider resources through Pulumi before mutation; SQL schema
changes remain Drizzle migrations. Do not enable a new auth provider or pull
hosted env into local app files as part of these examples.

Login identity lives in the `neon-auth` skill: choose Managed Better Auth, keep existing Better Auth or another IdP, or point at self-managed Better Auth when a required feature is outside Managed support.

Fetch https://neon.com/docs/ai/skills/neon-auth/SKILL.md

Until the released CLI catalog includes `neon-auth`, do not run `neon skills -s neon-auth` (unknown names fail). If the neon.com URL is unpublished, fetch https://github.com/neondatabase/agent-skills/blob/main/skills/neon-auth/SKILL.md

Implementation:

- Managed setup: https://neon.com/docs/ai/skills/neon-auth/references/managed-auth.md
- Self-managed pointer (not a second tutorial): https://neon.com/docs/ai/skills/neon-auth/references/self-managed.md
