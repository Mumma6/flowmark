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
or REPL after `pnpm --filter @flowmarkdev/node... build`. Use an **isolated local
project** and disposable loopback API only. Never point this at Production or
shared hosted data.

1. Start local API and PostgreSQL (`pnpm dev:stack` or your usual checkout session).
2. Create a project and write key in Studio Settings.
3. Pass `FLOWMARK_API_URL` and `FLOWMARK_API_KEY` for the loopback API and an
   isolated project write key (never commit the key).

4. Open **Runs** in Studio for the selected project and inspect the synthetic
   `booking.create` execution. Copied setup instructions or finishing onboarding
   is not evidence — only persisted runs are.

Synthetic properties include `synthetic: true` so runs are easy to distinguish
from real application traffic.
