# Flowmark API

Next.js shell for ingestion, registration, auth routes, and the tRPC router.
Workflow rules live in `@flowmark/api`. Persistence lives in `@flowmark/db`.
Better Auth configuration and the auth factory live in `@flowmark/auth`. This
app calls that factory and does not reimplement provider, cookie, origin, or
limit policy.

Local default: `http://localhost:3003`.

```sh
pnpm --filter @flowmark/server dev
pnpm --filter @flowmark/server test
pnpm --filter @flowmark/server lint
pnpm --filter @flowmark/server typecheck
```

HTTP integration tests need `TEST_DATABASE_URL`. See
[database integration tests](../../docs/development.md#database-integration-tests).

The router is `src/adapters/trpc.ts`. Customer-facing endpoint notes are in the
[API guide](https://docs.flowmark.dev/docs/api). The reference deployment is
`https://api.flowmark.dev`.
