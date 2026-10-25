# ADR 0002: Supabase PostgreSQL and Auth boundary

- Status: superseded
- Superseded by: [ADR 0006](./0006-mvp-0.1-infrastructure.md)

## Decision

Use Supabase as the intended hosted PostgreSQL and dashboard-auth provider. Use Drizzle for schema and typed database access, owned by `packages/db`.

The hosted-provider and dashboard-auth parts of this decision are superseded.
Drizzle, `packages/db`, and ordinary PostgreSQL via `DATABASE_URL` remain.

## Rationale

The early product needs conventional relational records and an approachable hosted option. Centralizing database access prevents app-specific models and provider calls from spreading.

## Consequences

This ADR is historical. Hosted PostgreSQL and dashboard auth are decided in
[ADR 0006](./0006-mvp-0.1-infrastructure.md): Neon for the reference database,
Better Auth email/password for people, and project keys for applications.

Drizzle, `packages/db`, and ordinary PostgreSQL via `DATABASE_URL` remain.
Private read/write keys stay hashed and project-scoped; browser keys stay a
separate public ingestion capability. The unused Supabase Auth scaffold has
been removed.
