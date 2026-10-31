# Flowmark API

Next.js shell for ingestion, Better Auth, registration, and the tRPC router.
Workflow rules live in `@flowmark/api`. Persistence lives in `@flowmark/db`.

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
