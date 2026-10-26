import { ProjectRuns } from "../../project-data"

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>
}) {
  const { search } = await searchParams
  return (
    <ProjectRuns
      initialSearch={typeof search === "string" ? search.slice(0, 200) : ""}
    />
  )
}
