# Security policy

Flowmark is open source workflow observability software. If you believe you
have found a security vulnerability, report it privately so we can investigate
before public disclosure.

## Reporting

Use [GitHub private vulnerability reporting](https://github.com/Mumma6/flowmark/security/advisories/new)
for this repository. Do not open a public issue for exploitable security bugs.

Include enough detail for us to reproduce the problem:

- Affected component (SDK, API, dashboard, docs site, or other)
- Steps to reproduce, or a minimal proof of concept when possible
- Impact you expect (for example, cross-project data access or credential exposure)
- Your contact if you want a reply

Customer-facing privacy and telemetry guidance lives in the product docs at
[docs.flowmark.dev](https://docs.flowmark.dev/docs/security-privacy). That
page is not a substitute for reporting code vulnerabilities here.

## Response expectations

Maintainers triage reports as they arrive. We aim to acknowledge receipt within
a few business days and to share a coarse status update when investigation
starts. Timelines depend on severity and complexity; there is no paid support
SLA.

We may ask follow-up questions, coordinate a fix, and request your patience
while a patch is prepared and released. We appreciate responsible disclosure.

## Out of scope

General product questions, feature requests, and deployment help belong in
GitHub Discussions or issues labeled for support, not in private security
reports. Reports must not include live credentials, production connection
strings, or copies of private maintainer configuration.

## Dependencies

GitHub **Dependabot alerts** and **Dependabot security updates** are enabled on
this repository. **Secret scanning** and **push protection** are enabled for
the public tree. There is no `.github/dependabot.yml` version-update schedule;
maintainers review dependency security pull requests when Dependabot opens them
rather than taking a weekly stream of version bumps.

Local development may still report additional findings through `pnpm audit`
(dev-only paths are not always covered by GitHub alerts). Those are triaged
separately and are not a substitute for reporting product vulnerabilities
through private advisory reporting above.
