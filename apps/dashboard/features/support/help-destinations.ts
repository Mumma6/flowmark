import { Array, Option, Result, pipe } from "effect"

export type HelpDestination = {
  readonly id:
    | "documentation"
    | "troubleshooting"
    | "security-privacy"
    | "product-issue"
    | "private-support"
    | "security-report"
  readonly label: string
  readonly href: string
  readonly description: string
}

const productIssueUrl = "https://github.com/Mumma6/flowmark/issues/new"
const securityReportUrl =
  "mailto:flowmark.dev@gmail.com?subject=Flowmark%20security%20report"

const documentationPage = (
  documentationUrl: string,
  page: "troubleshooting" | "security-privacy",
) =>
  pipe(
    Result.try({
      try: () => new URL(documentationUrl),
      catch: () => "invalid-documentation-url",
    }),
    Result.match({
      onFailure: () => Option.none<string>(),
      onSuccess: (url) =>
        pipe(
          Option.fromNullishOr(url.pathname.match(/^(.*\/docs)\/[^/]+\/?$/)),
          Option.map((match) => {
            url.pathname = `${match[1]}/${page}`
            url.search = ""
            url.hash = ""
            return url.toString()
          }),
        ),
    }),
  )

const optionalPage = (
  documentationUrl: string,
  page: "troubleshooting" | "security-privacy",
  destination: Omit<HelpDestination, "href">,
) =>
  pipe(
    documentationPage(documentationUrl, page),
    Option.match({
      onNone: () => Array.empty<HelpDestination>(),
      onSome: (href) => [{ ...destination, href }],
    }),
  )

/** Public help destinations. Omits a docs sibling when the configured docs URL has no /docs/<page> path. */
export function helpDestinations(
  documentationUrl: string,
): readonly HelpDestination[] {
  return [
    {
      id: "documentation",
      label: "Documentation",
      href: documentationUrl,
      description: "Product and SDK guides.",
    },
    ...optionalPage(documentationUrl, "troubleshooting", {
      id: "troubleshooting",
      label: "Troubleshooting",
      description: "Setup and connection problems.",
    }),
    ...optionalPage(documentationUrl, "security-privacy", {
      id: "security-privacy",
      label: "Security and privacy",
      description: "What telemetry is stored and how to limit it.",
    }),
    {
      id: "product-issue",
      label: "Report a product issue",
      href: productIssueUrl,
      description: "A public bug or feature request.",
    },
    {
      id: "private-support",
      label: "Contact the maintainer privately",
      href: "mailto:flowmark.dev@gmail.com",
      description:
        "Account, privacy or incident questions. No guaranteed response time.",
    },
    {
      id: "security-report",
      label: "Report a security vulnerability",
      href: securityReportUrl,
      description: "Private report for a suspected vulnerability.",
    },
  ]
}
