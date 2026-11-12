# Codex CLI verification

Version-specific local evidence, recorded **11 November 2026**. This record
verifies the installed CLI's OAuth and MCP implementation; it does not certify
other Codex surfaces or a hosted Flowmark deployment.

| Item             | Observed configuration                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Client           | `codex-cli 0.167.0-alpha.3.2`, bundled macOS executable                                                                                      |
| OS               | macOS 15.6.1, arm64                                                                                                                          |
| Source           | Staging `abc1552` plus the reconnect correction in this PR                                                                                   |
| Transport        | Streamable HTTP; tool traffic carried protocol header `2025-06-18`; discovery probes carried `2024-11-05`                                    |
| Registration     | Pre-registered public client, PKCE S256, no client secret; DCR and remote metadata fetching remained closed                                  |
| Callback         | Exact registered `http://127.0.0.1:4317/callback`; automatic loopback callback and explicit headless URL handoff exercised                   |
| Environment      | Loopback-only auth/consent/MCP adapters, disposable Compose PostgreSQL, isolated temporary CLI profile and empty workspace                   |
| Content          | Synthetic account/projects; one `audit.codex.synthetic` run with two events and reported counts `processed: 2`, `accepted: 1`, `rejected: 1` |
| Model processing | None: direct MCP calls through the installed CLI's experimental app-server API; no model turn, inference credentials or repository context   |

## Observed results

| Step                  | Result                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh add             | `codex mcp add` stored the server/public client and automatically started OAuth; its actual loopback callback completed successfully          |
| Explicit login        | `codex mcp login --no-browser` completed with the callback URL supplied through stdin                                                         |
| Consent               | Native email sign-in and the real signed consent bridge bound only the selected project; an empty selection returned 400                      |
| Discovery             | CLI discovered all six tools through protected-resource and issuer metadata                                                                   |
| Empty project         | Authorized workflow discovery returned an explicit empty collection before synthetic evidence was inserted                                    |
| Read                  | `get_connection` returned the selected project; `get_run` returned the two recorded events and Completed status                               |
| Context/evidence link | Shared version-1 selection and Studio link round-tripped; the CLI read the selected one-event page with a continuation cursor                 |
| Project isolation     | An explicit call for the ungranted project returned a tool error                                                                              |
| Persisted reconnect   | A fresh CLI app-server process reused its stored credentials and read the same run                                                            |
| Renewal               | Expiring only the isolated CLI credential cache triggered one real provider refresh; the grant family stayed unchanged and the read succeeded |
| Server revoke         | The connected CLI's next read failed using the same still-issued access token                                                                 |
| Reconnect consent     | After the correction below, fresh authorization returned to project consent without a client-supplied `prompt=consent`                        |
| Declined consent      | The provider denial callback made headless CLI login fail; it did not become a successful connection                                          |
| Local logout          | `codex mcp logout` completed; local credential removal is distinct from Flowmark's server-side revoke                                         |

The driver used the actual installed CLI for registration configuration, OAuth,
credential persistence, discovery and tool calls. It exposed existing Flowmark
adapters over real loopback HTTP; it did not replace the client with an SDK mock.
Browser sign-in/consent actions were automated through the real provider and
consent endpoints. The Studio link was checked as a versioned selection and
actual CLI read, **not** as a rendered browser-page walkthrough.

Renewal advanced only the disposable profile's cached expiry timestamp. The
provider's ten-minute JWT lifetime, stored grant state, shared clocks and hosted
settings were unchanged. This proves the client's real refresh exchange, not a
ten-minute wall-clock soak test. Temporary client drivers/profile credentials
are not shipped; permanent provider/SQL regressions cover the reconnect defect.

## Reconnect correction

Disconnect previously revoked tokens/project grants while leaving the provider's
cached resource consent intact. A later authorization could skip project
selection and issue a fresh token without usable project authority. Old tokens
still failed closed; the defect was the reconnect path.

The same revocation transaction now removes only resource permissions identified
by that user's matching Flowmark consent intents. It preserves unrelated
resources and consent/intent history. Account-wide delegated revocation applies
the same rule. Reconnection therefore returns through the native consent bridge
to an explicit project choice. Superseding a family during accepted consent
does not invalidate the newly accepted provider permission.

## Reproduction and limits

Use a fresh isolated CLI home, file credential storage and an operator-registered
public client with the exact callback printed by the CLI. Never copy a client
secret into configuration or enable registration to bypass an error.

```sh
codex mcp add flowmark --url http://127.0.0.1:<api-port>/mcp --oauth-client-id <public-client-id>
codex mcp login flowmark --no-browser --scopes openid,offline_access,flowmark:read
codex mcp logout flowmark
```

These are local verification examples, not working hosted connection promises.
The [official MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
describes the client controls; the observations above apply only to the named
binary and tested configuration. Automatic CIMD/DCR onboarding, remote/hosted
callbacks, model-mediated answers, rendered Studio navigation, Codex app, IDE
extension and cloud sessions remain unverified. No MCP App UI rendering was
tested in this CLI record. Other clients retain separate evidence records.

See the [auth perimeter](../auth-perimeter.md) and
[composed security audit](../agent-access-security-audit.md) for server-side
authority and cost boundaries. Business results remain application-reported
evidence; Completed does not establish that every record succeeded.
