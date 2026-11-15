# Booking setup demo

Runnable companion for [`booking-process.ts`](./booking-process.ts) and
[`booking-setup-scenarios.ts`](./booking-setup-scenarios.ts). It exercises the
same instrumentation markers without Flowmark executing booking work.

Default mode uses `MemoryTransport` only — **no HTTP** and no hosted calls.

## Default (in memory)

From the repository root:

```bash
pnpm exec tsc -p examples/tsconfig.json --noEmit
pnpm --filter @flowmarkdev/node test booking-setup-demo
```

The Vitest run executes `packages/sdk/test/booking-setup-demo.runtime.ts`, which
imports the shared scenario helpers from `examples/booking-setup-scenarios.ts`.
It covers:

- ordinary completion with a later confirmation (`confirmed`)
- partial availability (`no-availability` when `reserved: 0`)
- cancelled expectation before confirmation
- missing terminal evidence (step only — not proof the work is still running)
- preserved business error when provider submission fails

## Optional loopback delivery (Studio verification)

Call `runBookingSetupDemo({ deliver: true, apiUrl, apiKey })` from a local script
or REPL after `pnpm --filter @flowmarkdev/node... build`. Use the checkout's
loopback API only. Never point this at Production or shared hosted data.

From a checkout that does not already own a running Compose project:

```bash
pnpm dev:setup
pnpm infra up
pnpm db:setup
pnpm dev
```

`infra up` starts that checkout's database and does not migrate or seed.
`db:setup` is the explicit local migration and demo-fixture step. `pnpm dev`
does neither, and neither command resets another checkout's database. If
`infra up` reports `startedByThisCall: false`, leave that container alone.

`db:setup` provisions the documented local project and write key
`fm_demo_write_local_only`. Sign in at `http://localhost:3001` and continue
onboarding for that project. The existing secret is not shown again. The API
listens on `http://127.0.0.1:3003`; pass that origin as `apiUrl` and the local
write key as `apiKey`. Build `@flowmarkdev/node` first. Keep the script outside
the repository.

After delivery, finish onboarding and open the run from Explore. The live
execution is `booking.create` with external id `liveRunId`. Its reported
completion is evidence that the events were stored, not proof that booking work
succeeded. Copying an onboarding agent instruction does not send the events.

Synthetic properties include `synthetic: true` so runs are easy to distinguish
from real application traffic.

## Optional metadata preview

[`booking-definition.json`](./booking-definition.json) describes the existing
`bookingRef` lookup and `submitted` result count. The
[import preview guide](../docs/definition-imports.md) shows the session-authorized
dry run. It does not save configuration or change this example's instrumentation.

`pnpm test:integration` also verifies this unchanged example over a disposable
loopback HTTP listener and PostgreSQL, then reads its evidence through the real
session-authorized Studio handlers and investigation/confirmation projections.
This automated check does not require signing into a browser or use local demo data.
