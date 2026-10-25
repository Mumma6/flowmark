# ADR 0004: Keep an append-only workflow timeline

- Status: accepted

## Decision

Store workflow and run identity in normalized records and retain observed events as append-only timeline rows.

## Rationale

The product needs efficient workflow/run listing as well as the ordered facts behind a run timeline. A small hybrid schema supports both without CQRS or event-sourcing infrastructure.

## Consequences

Durations and aggregate success statistics are derived from event/run data by backend queries or services, not calculated inside the SDK.
