import { RunDetail } from "../../../../features/runs/investigation/run-detail"

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params
  return <RunDetail id={runId} />
}
