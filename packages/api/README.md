# @flowmark/api

Framework-independent use cases for Flowmark. The package owns application
errors, Effect services, ports, and the database-backed adapters those ports
use. It does not import Next.js or tRPC.

`apps/server` is the HTTP and tRPC shell. A different server can decode its own
requests, call the same services, and map typed errors to its own responses.

Project membership, ingestion keys, and project or key creation quotas stay
here. Email and password sessions, the auth factory, and signed proxy identity
live in `@flowmark/auth`. This package does not import that package.

```sh
pnpm --filter @flowmark/api test
pnpm --filter @flowmark/api typecheck
pnpm --filter @flowmark/api build
```

See [Architecture](../../docs/architecture.md) for the dependency direction and
the current use cases.
