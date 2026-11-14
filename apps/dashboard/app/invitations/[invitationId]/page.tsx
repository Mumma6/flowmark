import type { Metadata } from "next"
import { InvitationPanel } from "../../../features/project-sharing/invitation-panel"
export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Project invitation · Flowmark",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
}
export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ invitationId: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { invitationId } = await params
  const query = await searchParams
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-2xl content-start gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Review project access</h1>
      <InvitationPanel
        id={invitationId}
        token={typeof query.token === "string" ? query.token : ""}
      />
    </main>
  )
}
