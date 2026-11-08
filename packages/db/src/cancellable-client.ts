import type postgres from "postgres"

/** Driver boundary: keep cancellation attached through Query.values()/raw() chains. */
const cancelQueries = <Client extends Pick<postgres.Sql, "unsafe">>(
  client: Client,
  signal: AbortSignal,
): Client => {
  const unsafe = client.unsafe.bind(client)
  client.unsafe = ((...args: Parameters<typeof unsafe>) => {
    const query = unsafe(...args)
    const wrapped: typeof query = new Proxy(query, {
      get(target, property) {
        if (property === "then") {
          return (...callbacks: Parameters<typeof query.then>) => {
            const cancel = () => target.cancel()
            signal.addEventListener("abort", cancel, { once: true })
            if (signal.aborted) {
              cancel()
            }
            return target
              .then(...callbacks)
              .finally(() => signal.removeEventListener("abort", cancel))
          }
        }
        const value: unknown = Reflect.get(target, property, target)
        return typeof value === "function"
          ? (...params: unknown[]) => {
              const result: unknown = Reflect.apply(value, target, params)
              return result === target ? wrapped : result
            }
          : value
      },
    })
    return wrapped
  }) as typeof client.unsafe
  return client
}

export const cancellableClient = (
  client: postgres.Sql,
  signal: AbortSignal,
): postgres.Sql => {
  const begin = client.begin.bind(client)
  type Body = (transaction: postgres.TransactionSql) => Promise<unknown>
  client.begin = ((optionsOrBody: string | Body, body?: Body) =>
    typeof optionsOrBody === "function"
      ? begin((transaction) =>
          optionsOrBody(cancelQueries(transaction, signal)),
        )
      : begin(optionsOrBody, (transaction) =>
          body!(cancelQueries(transaction, signal)),
        )) as typeof client.begin
  return cancelQueries(client, signal)
}
