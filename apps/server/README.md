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

For local startup, follow [Compose setup](../../docs/development.md#local-postgresql-with-compose)
and use root `pnpm dev` to include dependency watchers. The direct app command
requires built workspace dependencies.

Run root `pnpm test:integration` for HTTP database coverage; the runner supplies
a proven disposable target. Do not configure a development database as
`TEST_DATABASE_URL`. See
[database integration tests](../../docs/development.md#database-integration-tests).

When `FLOWMARK_AGENT_ACCESS_ENABLED=true` and the API, issuer, and dashboard
origins resolve, this app mounts `POST /mcp` and the protected-resource
metadata routes from `@flowmark/mcp`. That package owns the six read-only
investigation tools. Disabled agent access returns 404 for those routes. The
router is `src/adapters/trpc.ts`. Customer-facing endpoint notes are in the
[API guide](https://docs.flowmark.dev/docs/api). The reference deployment is
`https://api.flowmark.dev`.
