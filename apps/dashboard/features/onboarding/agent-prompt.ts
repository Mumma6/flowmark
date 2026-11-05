export function instrumentationGuideUrl(apiOrigin: string): string {
  return `${apiOrigin}/v1/instrumentation`
}

/** Short instruction copied into an agent chat. The guide itself is fetched from the API. */
export function flowmarkAgentPrompt(apiOrigin: string): string {
  return [
    `Fetch and follow ${instrumentationGuideUrl(apiOrigin)}`,
    "Put the write key in the server environment yourself. Fetching this guide does not connect an agent.",
  ].join("\n")
}
