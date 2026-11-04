import { PgTransaction } from "drizzle-orm/pg-core"
import { Context } from "effect"
import type { FlowmarkDatabase } from "../client.js"

type Transaction = Parameters<Parameters<FlowmarkDatabase["transaction"]>[0]>[0]

/** CLI-only composition seam, tied to the actual owned transaction; never an environment/API switch. */
export const FixtureEventTransaction =
  Context.Reference<FlowmarkDatabase | null>(
    "@flowmark/db/FixtureEventTransaction",
    { defaultValue: () => null },
  )

export const ownsFixtureTransaction = (
  db: FlowmarkDatabase,
  fixture: FlowmarkDatabase | null,
) => db === fixture && db instanceof PgTransaction

/** Fixture conflicts roll back the owning transaction; normal ingestion retains its envelope locks/savepoint. */
export const eventTransaction = <A>(
  db: FlowmarkDatabase,
  fixture: FlowmarkDatabase | null,
  use: (transaction: Transaction) => Promise<A>,
): Promise<A> =>
  ownsFixtureTransaction(db, fixture)
    ? use(db as Transaction)
    : db.transaction(use)
