# ADR 0001: Use pnpm workspaces and Turborepo

- Status: accepted

## Decision

Use pnpm workspaces for package management and Turborepo for task orchestration across apps and shared packages.

## Rationale

This provides a familiar monorepo layout, dependency-aware build tasks, and shared TypeScript tooling without building custom scripts.

## Current implementation

`pnpm dev` uses Turbo's interactive UI for API/dashboard/harness and the
core/SDK/db/API/auth TypeScript watchers. All libraries build before development
tasks start. `pnpm dev --ui=stream` provides ordinary logs for agents;
`pnpm dev:all` includes all six applications. `pnpm dev:stack` is the named
command that starts this checkout's Compose PostgreSQL, those applications,
and Drizzle Studio. `pnpm dev` and `pnpm dev:all` still require a healthy
database and do not start Studio. Migrations remain an explicit prerequisite,
not a hidden side effect of starting a web server.
