# @flowmark/auth

Internal authentication package for Flowmark. It is private and is not
published to npm.

It owns Better Auth configuration, the auth factory, local fixture user
provisioning, signed proxy identity, and the authentication-specific limit
policy. It depends on `@flowmark/db` for the auth tables and the atomic
limiter write. `@flowmark/db` does not depend on this package.

Project membership, ingestion keys, and project/key creation quotas stay in
`@flowmark/api` and `@flowmark/db`. SQL and migrations stay in `@flowmark/db`.

| Export                           | Use                                                                 |
| -------------------------------- | ------------------------------------------------------------------- |
| `@flowmark/auth`                 | Server auth factory and secret resolution. Not for browser bundles. |
| `@flowmark/auth/client-identity` | Signed proxy identity. No database or provider imports.             |
| `@flowmark/auth/limits`          | Durable auth-limit storage adapter.                                 |
| `@flowmark/auth/seed`            | Local fixture account provisioning.                                 |

`pnpm db:seed` and `pnpm db:setup` build `@flowmark/db` and its workspace
dependencies, including core, and then run this
package's local commands. They require the checkout-owned Compose database and refuse production,
unmanaged and non-loopback databases. Setup also refuses a migration URL naming a different local host,
port, database, or role before SQL. It migrates and seeds through the runtime
URL, retaining that URL's connection settings. Hosted environment names and
migration wrappers are unchanged.
