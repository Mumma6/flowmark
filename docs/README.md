# Documentation

Contributor guides that ship with the public repository:

- [Contributing](../CONTRIBUTING.md): onboarding, branches, local-only apps,
  and self-hosting expectations.
- [Security policy](../SECURITY.md): private vulnerability reporting.
- [Development setup](./development): workspace commands, local demo, database,
  and checks.
- [Database integration tests](./development#database-integration-tests): local
  test setup and the separate disposable-Postgres PR job.
- [Health and failure diagnostics](./development#health-and-failure-diagnostics):
  liveness limits, safe log fields, and API storage versus dashboard proxy errors.
- [Application releases](./releases): feature PRs into staging, release PRs into
  main, verification, versioning, and recovery. Synchronization is needed for
  independent main changes such as hotfixes, not after ordinary releases.
- [Architecture](./architecture): service boundaries, persistence, local auth,
  and current system constraints.
- [Architecture decisions](./decisions/0001-turborepo): accepted decisions and
  their consequences.

Customer-facing SDK and product docs live in `apps/docs` and at
[docs.flowmark.dev](https://docs.flowmark.dev).

The repository root `README.md` is the shared entry point.
