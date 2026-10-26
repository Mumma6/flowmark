export const docsUrl =
  process.env.NEXT_PUBLIC_FLOWMARK_DOCS_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3002/docs/introduction"
    : "https://docs.flowmark.dev/docs/introduction")

export const appUrl =
  process.env.NEXT_PUBLIC_FLOWMARK_APP_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://app.flowmark.dev")

export const githubUrl = "https://github.com/Mumma6/flowmark"
