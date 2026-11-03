import type postgres from "postgres"

/** Drizzle uses unsafe(), which disables preparation unless the query opts in explicitly. */
const prepareQueries = <Client extends Pick<postgres.Sql, "unsafe">>(
  client: Client,
): Client => {
  const unsafe = client.unsafe.bind(client)
  client.unsafe = ((...args: Parameters<typeof unsafe>) =>
    unsafe(args[0], args[1], {
      ...args[2],
      prepare: true,
    })) as typeof client.unsafe
  return client
}

type TransactionBody = (sql: postgres.TransactionSql) => Promise<unknown>

/** Private direct-connection fixture optimization; normal application clients never use it. */
export const preparedClient = (client: postgres.Sql): postgres.Sql => {
  const begin = client.begin.bind(client)
  client.begin = ((
    optionsOrBody: string | TransactionBody,
    body?: TransactionBody,
  ) => {
    if (typeof optionsOrBody === "function") {
      return begin((transaction) => optionsOrBody(prepareQueries(transaction)))
    }
    return begin(optionsOrBody, (transaction) =>
      body!(prepareQueries(transaction)),
    )
  }) as typeof client.begin
  return prepareQueries(client)
}
