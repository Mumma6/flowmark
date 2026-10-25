export const docsUrl =
  process.env.NEXT_PUBLIC_FLOWMARK_DOCS_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3002/docs/introduction"
    : "/docs/introduction")

export const githubUrl = "https://github.com/Mumma6/flowmark"
