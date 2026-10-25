# Telemetry Interoperability Decision

> Decision note, October 25, 2026. No OpenTelemetry migration or dependency is
> proposed.

## Decision

Keep Flowmark's current validated event model and transport for this phase.
There is no demonstrated compatibility or maintenance problem that warrants
adding an OpenTelemetry dependency, exporter, or replacement model.

The local invoice-import scenario traversed the SDK, PostgreSQL-backed API,
read model, and dashboard with the current event model. The structured result,
handled validation errors, measured operation, absolute progress snapshots,
and terminal failure remained distinguishable in the run investigation.

## Options considered

1. **Retain the custom model and transport (chosen for now).** This keeps the
   run-oriented SDK small and preserves the current persistence and dashboard
   behavior. It does not provide a general-purpose OTel collector integration.
2. **Keep the Flowmark API and add an optional OTel exporter later.** This could
   serve users who already operate an OTel collector without forcing the
   collector model onto application code. It would add mapping, configuration,
   and delivery behavior that no current user need has validated.
3. **Replace the public model with OTel concepts.** This would make
   instrumentation decisions and compatibility guarantees central to the SDK
   before the product's run/result semantics have been validated. It is not
   justified and would be a fundamental product/API decision.

## Revisit when

- A real user needs Flowmark events delivered to an existing OTel collector.
- Multiple integrations demonstrate that a Flowmark-specific transport is
  materially increasing maintenance.
- A concrete interoperability requirement can be tested without losing
  run/result meaning or expanding the product into generic tracing.

Until then, do not implement an exporter or migration speculatively. This
decision is limited to the current development phase and should be revisited if
those conditions change.
