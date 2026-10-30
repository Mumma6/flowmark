export const dynamic = "force-dynamic"

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "flowmark-api",
      commit:
        process.env.FLOWMARK_DEPLOYMENT_SHA ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        null,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
