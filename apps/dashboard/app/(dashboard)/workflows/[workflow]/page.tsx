import { ProjectRuns } from "../../../project-data"

export default async function WorkflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ workflow: string }>
  searchParams: Promise<{ search?: string | string[] }>
}) {
  const { workflow } = await params
  const { search } = await searchParams
  return (
    <ProjectRuns
      workflow={workflow}
      initialSearch={typeof search === "string" ? search.slice(0, 200) : ""}
    />
  )
}
