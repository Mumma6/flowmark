# ADR 0001: Use pnpm workspaces and Turborepo

- Status: accepted

## Decision

Use pnpm workspaces for package management and Turborepo for task orchestration across apps and shared packages.

## Rationale

This provides a familiar monorepo layout, dependency-aware build tasks, and shared TypeScript tooling without building custom scripts.

## Current implementation

`pnpm dev` uses Turbo's interactive terminal UI for all five apps and the
core/SDK TypeScript watchers. Core and SDK builds run before development tasks
start. `pnpm dev:stream` provides ordinary log output for non-interactive
terminals. Database startup and migrations remain explicit prerequisites, not
hidden side effects of starting a web server.
