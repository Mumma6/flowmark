import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

interface Article {
  id: string
  title: string
}
interface Edition {
  stories: number
  rejected: number
}
interface JobState {
  attempt: number
}
export interface BriefingResult {
  jobId: string
  attempt: number
  stories: number
  rejected: number
  unavailableSources: number
  partial: boolean
}

async function readAttempt(path: string): Promise<number> {
  try {
    return (JSON.parse(await readFile(path, "utf8")) as JobState).attempt
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0
    throw error
  }
}

async function requestJson<T>(
  path: string,
  jobId: string,
  attempt: number,
): Promise<T> {
  const url = new URL(path, process.env.PROVIDER_API_URL)
  url.searchParams.set("jobId", jobId)
  url.searchParams.set("attempt", String(attempt))
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Provider rejected ${path}: ${response.status}`)
  return response.json() as Promise<T>
}

export async function generateBriefing(jobId: string): Promise<BriefingResult> {
  if (!/^[a-z0-9-]+$/.test(jobId)) throw new Error("Invalid job id")
  const directory = process.env.JOB_STATE_DIRECTORY
  if (!directory) throw new Error("JOB_STATE_DIRECTORY is required")
  await mkdir(directory, { recursive: true })
  const statePath = join(directory, `${jobId}.json`)
  const attempt = (await readAttempt(statePath)) + 1
  await writeFile(statePath, JSON.stringify({ attempt }))

  const sources = await Promise.allSettled([
    requestJson<Article[]>("/news", jobId, attempt),
    requestJson<Article[]>("/repositories", jobId, attempt),
  ])
  const articles = sources.flatMap((source) =>
    source.status === "fulfilled" ? source.value : [],
  )
  const unavailableSources = sources.filter(
    (source) => source.status === "rejected",
  ).length
  if (articles.length === 0) throw new Error("No usable articles")

  const edition = await requestJson<Edition>("/editor", jobId, attempt)
  const result = {
    jobId,
    attempt,
    stories: edition.stories,
    rejected: edition.rejected,
    unavailableSources,
    partial: unavailableSources > 0 || edition.rejected > 0,
  }
  await writeFile(
    join(directory, `${jobId}-edition.json`),
    JSON.stringify(result),
  )
  return result
}
