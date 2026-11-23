export function instrumentationGuideUrl(apiOrigin: string): string {
  return `${apiOrigin}/v1/instrumentation`
}

/** Public documentation and project context only. Never include credentials. */
export function flowmarkAgentPrompt(
  apiOrigin: string,
  project?: { readonly id: string; readonly name: string } | null,
): string {
  return [
    `Help me add Flowmark to this repository. Start with ${instrumentationGuideUrl(apiOrigin)} for supported runtimes and setup.`,
    ...(project
      ? [
          `Flowmark project: ${JSON.stringify(project.name)} (project ID: ${project.id}).`,
        ]
      : []),
    "Inspect this workspace for the runtime and existing instrumentation. Shortlist two or three processes with the proposed boundary, value, fields and unknowns. Show the first patch and its collected fields. Wait for my approval before installing dependencies or editing files. Start with that one approved change.",
    "I set the write key in the server environment. Never read, print, commit or request the key in chat. Use a safe existing execution and report what you tested, what arrived and what you read back. Use Studio if project-approved MCP is unavailable and state which checks remain unverified.",
    "After the repository is connected, planning starts from the ticket and review starts from the diff. Consult runtime evidence when it could change the decision. Carry a citation and a short decision summary into review. If the read is skipped, denied or unavailable, do not state a production fact.",
  ].join("\n\n")
}
