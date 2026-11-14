import { randomUUID } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { sql } from "drizzle-orm"
import { Array, Effect, Order, pipe } from "effect"
import { describe, expect, it } from "vitest"
import { createDatabase } from "@flowmark/db"
import { DatabaseOperation, runQuery } from "@flowmark/db/persistence"
import { runTransaction } from "@flowmark/db/persistence"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "lifecycle additive upgrade",
  () => {
    it("preserves populated legacy projects and keys before enabling fences", async () => {
      const connection = createDatabase(process.env.TEST_DATABASE_URL!)
      const namespace = `lifecycle_upgrade_${randomUUID().replaceAll("-", "")}`
      const schema = sql.identifier(namespace)
      const directory = new URL(
        "../../../../packages/db/migrations/",
        import.meta.url,
      )
      const files = pipe(
        readdirSync(directory),
        Array.filter(
          (name) => /^00\d\d_.*\.sql$/.test(name) && name.slice(0, 4) <= "0026",
        ),
        Array.sort(Order.String),
      )
      const legacy = Array.filter(files, (name) => name.slice(0, 4) < "0024")
      const upgrade = Array.filter(files, (name) => name.slice(0, 4) >= "0024")
      const query = <A>(use: () => Promise<A>) =>
        runQuery(DatabaseOperation.DataLifecycle, use)
      const migrate = (name: string) =>
        runTransaction(
          DatabaseOperation.Migrate,
          (use) => connection.db.transaction(use),
          (tx) =>
            Effect.gen(function* () {
              yield* query(() =>
                tx.execute(sql`SET LOCAL search_path TO ${schema}`),
              )
              const source = readFileSync(
                new URL(name, directory),
                "utf8",
              ).replaceAll('"public".', `"${namespace}".`)
              yield* Effect.forEach(
                source.split("--> statement-breakpoint"),
                (statement) =>
                  statement.trim()
                    ? query(() => tx.execute(sql.raw(statement))).pipe(
                        Effect.asVoid,
                      )
                    : Effect.void,
                { discard: true },
              )
            }),
        )
      const projectId = randomUUID()
      const workspaceId = randomUUID()
      const userId = randomUUID()
      try {
        await connection.db.execute(sql`CREATE SCHEMA ${schema}`)
        await Effect.runPromise(
          Effect.forEach(legacy, migrate, { discard: true }),
        )
        await connection.db.execute(
          sql`INSERT INTO ${schema}.workspaces (id, name) VALUES (${workspaceId}::uuid, 'Legacy synthetic workspace')`,
        )
        await connection.db.execute(
          sql`INSERT INTO ${schema}.projects (id, workspace_id, name) VALUES (${projectId}::uuid, ${workspaceId}::uuid, 'Legacy project')`,
        )
        await connection.db.execute(
          sql`INSERT INTO ${schema}.project_api_keys (project_id, key_hash, permission) VALUES (${projectId}::uuid, 'synthetic-legacy-hash', 'write')`,
        )
        await connection.db.execute(
          sql`INSERT INTO ${schema}."user" (id, name, email, email_verified, created_at, updated_at) VALUES (${userId}, 'Legacy synthetic user', ${`${userId}@example.test`}, true, now(), now())`,
        )
        await connection.db.execute(
          sql`INSERT INTO ${schema}.project_members (user_id, project_id, role) VALUES (${userId}, ${projectId}::uuid, 'owner')`,
        )
        await Effect.runPromise(
          Effect.forEach(upgrade, migrate, { discard: true }),
        )
        const [row] = await connection.db.execute<{
          name: string
          projectEpoch: number
          keyEpoch: number
          pending: string | null
          floor: string | null
        }>(
          sql`SELECT p.name, p.credential_epoch AS "projectEpoch", k.credential_epoch AS "keyEpoch", p.lifecycle_operation_id AS pending, p.new_run_after AS floor FROM ${schema}.projects p JOIN ${schema}.project_api_keys k ON k.project_id = p.id WHERE p.id = ${projectId}::uuid`,
        )
        expect(row).toMatchObject({
          name: "Legacy project",
          projectEpoch: 0,
          keyEpoch: 0,
          pending: null,
          floor: null,
        })
        const [version] = await connection.db.execute<{ version: string }>(
          sql`SELECT column_default AS version FROM information_schema.columns WHERE table_schema = ${namespace} AND table_name = 'data_lifecycle_operations' AND column_name = 'contract_version'`,
        )
        expect(version.version).toBe("1")
        const [user] = await connection.db.execute<{ pending: string | null }>(
          sql`SELECT lifecycle_operation_id AS pending FROM ${schema}."user" WHERE id = ${userId}`,
        )
        expect(user.pending).toBeNull()
        // No foreign keys, types or trigger functions reference the live public schema.
        const [foreign] = await connection.db.execute<{ count: number }>(
          sql`SELECT count(*)::int AS count FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid JOIN pg_namespace n ON n.oid = child.relnamespace JOIN pg_class parent ON parent.oid = c.confrelid JOIN pg_namespace pn ON pn.oid = parent.relnamespace WHERE c.contype = 'f' AND n.nspname = ${namespace} AND pn.nspname <> ${namespace}`,
        )
        expect(foreign.count).toBe(0)
      } finally {
        await connection.db.execute(sql`DROP SCHEMA ${schema} CASCADE`)
        await connection.close()
      }
    }, 15000)
  },
)
