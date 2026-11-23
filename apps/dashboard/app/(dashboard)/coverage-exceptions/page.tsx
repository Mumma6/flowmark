import { CoveragePage } from "../../../features/coverage-exceptions/coverage-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    question?: string
    repair?: string
  }>
}) {
  const params = await searchParams
  return (
    <CoveragePage
      status={params.status}
      question={params.question}
      repair={params.repair}
    />
  )
}
