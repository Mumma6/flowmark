# ADR 0002: Supabase PostgreSQL and Auth boundary

- Status: accepted

## Decision

Use Supabase as the intended hosted PostgreSQL and dashboard-auth provider. Use Drizzle for schema and typed database access, owned by `packages/db`.

## Rationale

The early product needs conventional relational records and an approachable hosted option. Centralizing database access prevents app-specific models and provider calls from spreading.

## Consequences

Supabase remains an intended hosting/auth option, not an active requirement.
The current implementation runs against ordinary PostgreSQL through
`DATABASE_URL`, with Drizzle migrations and explicit demo provisioning.
Private read/write keys are hashed and project-scoped; browser keys have a
separate public ingestion capability, origin allowlists, and a shared quota.

The dashboard currently uses an explicitly enabled fixed demo account.
Sign-in/sign-up screens are visual only: session handling, registration, and
production account provisioning are not implemented. Do not describe the
Supabase scaffold as working authentication or rely on it for tenant access.
