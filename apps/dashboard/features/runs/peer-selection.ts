import type { RouterInputs } from "../../lib/api/types"

export function peerSelection(
  params: Pick<URLSearchParams, "get">,
): RouterInputs["run"]["compare"]["selection"] {
  const days = Number(params.get("peerDays") ?? 30)
  return {
    days,
    environment:
      params.get("peerEnvironment") === "all"
        ? ("all" as const)
        : ("same" as const),
    sameRelease: params.get("peerRelease") === "same",
    ...(params.get("peerDimension")
      ? {
          dimensionKey: params.get("peerDimension") ?? "",
          dimensionValue: params.get("peerValue") ?? "",
        }
      : {}),
  }
}
