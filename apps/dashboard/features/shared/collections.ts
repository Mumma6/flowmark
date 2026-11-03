import { Array as Arr } from "effect"
export function paginate<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number,
) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.max(1, Math.min(requestedPage, pages))
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pages,
    total: items.length,
  }
}

export function groupBy<T>(items: readonly T[], key: (item: T) => string) {
  const tagged = Arr.map(items, (item) => [key(item), item] as const)
  const groups = Arr.groupBy(tagged, ([name]) => name)
  return Arr.map(
    Arr.dedupe(Arr.map(tagged, ([name]) => name)),
    (name): [string, T[]] => [name, Arr.map(groups[name]!, ([, item]) => item)],
  )
}
