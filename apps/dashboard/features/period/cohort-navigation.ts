import {
  exploreHref,
  readExplorerFilters,
} from "../runs/explorer/explorer-filters"

/** Same run.list cohort as `/runs?…`, opened on the mounted Explore surface. */
export function exploreCohortHref(runListHref: string) {
  const query = runListHref.includes("?")
    ? runListHref.slice(runListHref.indexOf("?") + 1)
    : ""
  return exploreHref(readExplorerFilters(new URLSearchParams(query)))
}

export function mapRecordedChangeHrefs(
  changes: readonly {
    readonly id: string
    readonly title: string
    readonly detail: string
    readonly href: string
  }[],
) {
  return changes.map((change) => ({
    ...change,
    href: change.href.startsWith("/runs?")
      ? exploreCohortHref(change.href)
      : change.href,
  }))
}
