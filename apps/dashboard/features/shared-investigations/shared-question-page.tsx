"use client"
import { Alert, AlertDescription, Button } from "@flowmark/ui"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Result, Schema } from "effect"
import { useRouter } from "next/navigation"
import { authClient } from "../auth/auth-client"
import { useProject } from "../projects/project-context"
import { useTRPCClient } from "../platform/api-trpc"
import { DataState } from "../shared/dashboard-components"
import { sharedSelectionHref } from "./shared-selection"
const Id = Schema.String.check(Schema.isGUID())
export function SharedQuestionPage({
  projectId,
  id,
}: {
  readonly projectId: string | null
  readonly id: string
}) {
  const { current, projects, select, pending, error, retry } = useProject()
  if (!projectId || !Schema.is(Id)(projectId) || !Schema.is(Id)(id)) {
    return <p role="alert">This shared link is invalid.</p>
  }
  if (pending || error) {
    return <DataState pending={pending} error={error} retry={retry} />
  }
  if (current?.id !== projectId) {
    return (
      <section className="grid justify-items-start gap-3">
        <h1 className="text-xl font-semibold">Open shared investigation</h1>
        <p className="text-sm">
          Select the link's project before loading its question. The link grants
          no project access.
        </p>
        {projects.some((project) => project.id === projectId) ? (
          <Button onClick={() => select(projectId)}>
            Select shared question's project
          </Button>
        ) : (
          <p role="alert">
            This project is unavailable to your account. Sign in with an account
            that already has access.
          </p>
        )}
      </section>
    )
  }
  return (
    <AuthorizedSharedQuestion
      key={`${projectId}:${id}`}
      projectId={projectId}
      id={id}
    />
  )
}
function AuthorizedSharedQuestion({
  projectId,
  id,
}: {
  readonly projectId: string
  readonly id: string
}) {
  const client = useTRPCClient(),
    identity = authClient.useSession(),
    router = useRouter()
  const question = useQuery({
    queryKey: [
      "shared-question",
      identity.data?.user.id,
      identity.data?.session.id,
      projectId,
      id,
    ],
    queryFn: ({ signal }) =>
      client.sharedInvestigations.get.query({ projectId, id }, { signal }),
    enabled: Boolean(identity.data),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  })
  const open = useMutation({
    mutationFn: async () => {
      const value = await client.sharedInvestigations.get.query({
        projectId,
        id,
      })
      return Result.match(sharedSelectionHref(projectId, value.selection), {
        onSuccess: (href) => href,
        onFailure: () => {
          throw new Error(
            "This shared question format is unsupported. Reload Studio or return to investigations.",
          )
        },
      })
    },
    onSuccess: (href) => router.push(href),
  })
  if (question.isError || open.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {question.error?.message ?? open.error?.message} The link may be
          revoked or your permissions may have changed.{" "}
          <Button
            variant="outline"
            onClick={() => {
              open.reset()
              void question.refetch()
            }}
          >
            Retry shared question
          </Button>
          <a className="underline" href="/investigations">
            Back to investigations
          </a>
        </AlertDescription>
      </Alert>
    )
  }
  if (!question.data) {
    return <p role="status">Checking shared question access…</p>
  }
  return (
    <section className="grid min-w-0 justify-items-start gap-4">
      <h1 className="break-words text-2xl font-semibold">
        {question.data.title}
      </h1>
      <p className="text-sm text-muted-foreground">
        Shared {question.data.depth} question · created{" "}
        {question.data.createdAt}. Opening recomputes from retained evidence
        with your current permissions. This is not a captured result.
      </p>
      <Button disabled={open.isPending} onClick={() => open.mutate()}>
        {open.isPending ? "Checking access…" : "Open live evidence"}
      </Button>
      <a className="text-sm underline" href="/investigations">
        Back to investigations
      </a>
    </section>
  )
}
