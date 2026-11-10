# ADR 0011: One read-only MCP App evidence view

- Status: accepted by maintainer on 2026-11-10 for implementation and local synthetic testing
- Date: 2026-11-10
- Task: Product TASK-008.2
- Baseline: `701718d` on `staging` (PR #166 merged)

## Proposed result

A compatible host renders the existing `RunSnapshot` after `get_run` returns
one authorized events page. The same projection remains available in Studio
and the local supplied-data harness. No new tool, query, public REST client,
OAuth resource, credential type or application execution capability is added.
Other `get_run` sections retain their complete existing text/structured result;
the view explicitly reports that those sections have no visual projection.

The maintainer explicitly approved implementation and local synthetic-host testing on
10 November 2026. Compatibility and smoke outcomes are recorded separately below.

## Dependencies and selected host

Use the stable MCP Apps extension dated **2026-01-26**, through the official
SDK **`@modelcontextprotocol/ext-apps@2.0.4`**. Use its `App` view API and
`registerAppTool`, `registerAppResource`, `getUiCapability` server helpers.
Use **`@modelcontextprotocol/client@2.3.1`**, aligned with the installed server
and core **2.3.1**; retain existing Zod **4.6.7**, React/React DOM **19.3.1**
and Effect **4.1.0**. Registry metadata was inspected without installation:
the SDK accepts the existing v2 MCP and Zod versions and requires Node >=20,
within Flowmark's Node >=20.19 baseline. Peer ranges are preliminary evidence;
the installation/type/runtime probe must establish actual compatibility.

Select the upstream **Basic Host example v2.0.4**, exact source revision
**`7af9a75da720b8a81be0f9aff47b25f75e9530ad`**, as the first real host.
Run it in an isolated temporary checkout against loopback synthetic fixtures.
It is an independent upstream host, not a Flowmark imitation or an asserted
Codex/Cursor/Claude integration. Record upstream lockfile/install provenance,
actual resolved dependencies, browser version and host revision in the smoke
record. Its own dependencies remain outside the Flowmark workspace. If that
revision requires an unreviewed workaround, stop and revise this proposal.

Approval covers installing the SDK/client pins, promoting existing core/Zod
versions to direct peers where required, and a private view package with pinned
build dependencies **esbuild 0.25.12** and **Tailwind 3.4.17** (both already in
the repository graph). No auth/database/provider upgrade is included. Inspect
the lockfile diff before proceeding; unexpected upgrades require a revised
proposal. Do not publish any package.

## Ownership and packaging

Add private `@flowmark/evidence-view` under `packages/evidence-view`:

- A pure projection/schema subpath extracts the existing Studio mapper and
  harness validator, accepting only the minimal presentation inputs. No API,
  auth, database, Next.js or credential imports. Its output remains the existing
  `Omit<RunSnapshotProps, "actions">`, including coverage and omissions.
- The browser entry renders `@flowmark/ui`'s existing `RunSnapshot` and connects
  through the official `App` API. Do not move application policy into this package.
- Build one self-contained HTML resource containing its script, theme tokens and
  compiled shared Tailwind styles. Export generated HTML as a bundled server
  module, so serverless packaging does not depend on an untraced filesystem path.
  Fail the build if the HTML exceeds **1 MiB UTF-8**, contains external asset
  references or requires eval. This static code limit does not enlarge the
  existing **64 KiB tool-result or request limits**.
- Define real build/lint/typecheck/test scripts and include the existing Turbo
  dependency graph; no persistent CI or hosted configuration changes.

`@flowmark/mcp` imports the pure projector/resource exports; Studio and harness
import the same projection/schema. Browser code must never import the MCP/auth
runtime. Tests exercise these import boundaries and inspect generated assets.

## Protocol, authorization and fallback

The view resource is fixed: **`ui://flowmark/run-evidence/v1.html`**, MIME
**`text/html;profile=mcp-app`**. It contains static code, never selected evidence,
project identity, bearer tokens, cookies, environment values or runtime config.

Negotiate the UI MIME capability using the official helper. Add UI metadata to
`get_run` only for compatible clients; preserve all six tool names and existing
input schemas. Mark the linked tool model-visible only: this first view never
initiates tool calls. Unsupported clients keep the unchanged complete
`content` and `structuredContent`, including references, omissions and cursors.
Resource failures cannot turn a successful tool read into an empty result.

Existing admission, live grant/project resolution, timeouts, SQL limits and
response budgeting remain before every evidence read. Resource reads must also
check the live connection and bounded admission; allow only the exact static URI.
Resource requests carry no run/project/cursor parameters. Neither a UI capability,
resource URI nor a message establishes identity. No new unauthenticated route or
synthetic bypass is shipped. Disabled agent access remains disabled.

The SDK initializes the view over the host channel. Validate the received
`get_run` result, run/project consistency and bounded page before projection.
Arguments alone never render evidence or select a credential. Only a completed,
valid supplied result produces a snapshot. Unknown sections, malformed or error
results show explicit fallback/error state. Supplied data is copied evidence;
receiving it does not establish current authorization, liveness or freshness.

Keep the existing structured/text result unchanged rather than duplicating it
in UI metadata. A host may forward the entire authorized diagnostic tool result
to the isolated view, including raw payload fields; the view projects only the
allowlisted event metadata and neither renders nor persists the other fields.
This is **not** a business-safe redaction boundary or proof that raw data never
entered the iframe. Real telemetry must not be used in the initial host smoke.

## Sandbox and messages

Declare empty network/resource/frame domain lists and no browser permissions.
The resource bundles all required code/styles; no CDN, analytics, external
images/fonts, nested frames, forms, navigation links, cookies or local storage.
Use host-enforced sandbox/CSP, including a separate-origin proxy for the selected
web host. A meta CSP alone is not sufficient. Inspect actual enforcement in the
smoke instead of inferring it from resource metadata. Do not weaken browser or
host security controls to make the smoke pass.

Use the SDK transport, not a second handwritten JSON-RPC/postMessage framework.
Verify its source-window/origin checks for the actual sandbox topology in the
probe, including opaque-origin behavior. Reject unrelated windows and unexpected
messages. No view-side tool calls, resource reads, model-context updates,
sampling, chat messages, external links or log payloads are emitted. The host
remains an authorized data recipient; a malicious authorized host can already
read its tool responses and cannot be made trustworthy by the view.

Register result/error/cancellation/context/teardown handlers before connecting.
Clear evidence on an invalid replacement result, cancellation or teardown;
release listeners/observers on disposal. Apply only validated theme/dimensions
from host context; never use host values as HTML, URLs, script or permissions.
No polling or automatic refresh. Additional navigation, expired-state handling
and selection lifecycle remain TASK-008.3's separate implementation scope.

## Probe and acceptance after approval

1. Install exact approved dependencies, inspect the lockfile diff and typecheck
   the SDK/server adapter against the existing v2 handler. If helper API/type
   compatibility fails, revise this decision rather than upgrading auth/SDK pins.
2. Test capability negotiation and unchanged unsupported-host fallback; keep
   event/project references and page semantics equal across all three surfaces.
3. Exercise foreign/revoked grants, exact resource URI, disabled mode, malformed
   results, oversized pages, hostile strings, unrelated message windows and
   cancellation/teardown cleanup. Scan the generated browser resource for private
   server modules, key canaries, remote assets and executable telemetry.
4. Run the independent Basic Host with a loopback synthetic MCP fixture and the
   real generated resource. Verify rendering, milestone keyboard interaction,
   theme, CSP network denial and invalid-result clearing. Record exact versions
   and observed results. No model API calls, hosted login, user tokens, existing
   telemetry or global client configuration changes.
5. Run affected AUTH-profile tests and managed disposable PostgreSQL integration;
   then root `pnpm check` before a normal PR into `staging`. Source readiness,
   actual host acceptance and hosted rollout remain separate statuses.

## Approval boundary

[ADR 0007](0007-connect-agent-mcp-dependencies.md) requires explicit maintainer
approval before adding MCP packages. The portable-evidence task also requires
review of new UI/protocol dependencies. Approving this proposal authorizes the
local dependency probe, implementation and synthetic local host verification
above; it does not authorize publication, hosted exposure, deployment, credentials
or transmission of existing telemetry to an external model/provider.

## Sources inspected

- [Official stable extension specification, pinned v2.0.4](https://github.com/modelcontextprotocol/ext-apps/blob/v2.0.4/specification/2026-01-26/apps.mdx)
- [Official SDK manifest and peer dependencies](https://github.com/modelcontextprotocol/ext-apps/blob/v2.0.4/package.json)
- [Official server helper exports](https://github.com/modelcontextprotocol/ext-apps/blob/v2.0.4/src/server/index.ts)
- [Independent Basic Host and sandbox](https://github.com/modelcontextprotocol/ext-apps/tree/v2.0.4/examples/basic-host)
- [Official release history](https://github.com/modelcontextprotocol/ext-apps/releases/tag/v2.0.4)

## Accepted reference-host adaptation and observed smoke

The pinned Basic Host constructs its MCP client without declaring the
`io.modelcontextprotocol/ui` capability. Flowmark's approved capability-gated
adapter must therefore supply the text fallback to this unmodified host.
The upstream Express listeners also omit a host address, binding all interfaces.
Do not silently bypass negotiation or run all-interface listeners.

Proposed temporary-checkout-only amendment (no SDK/Flowmark policy changes):
add the standard UI MIME capability to the two upstream Client constructors,
and bind both reference-host listeners explicitly to `127.0.0.1`. Keep the
upstream AppBridge, double iframe, CSP, result relay and renderer unchanged.
The maintainer explicitly approved that temporary four-site patch on 10 November 2026. It was applied only in the reference checkout. The smoke is a patched
reference-host result, not an unmodified-upstream or named-product proof.

The checkout's original client/core/server pins were 2.0.0 and its Client defaults
to the legacy handshake. The local probe aligned those peers to the already
approved **2.3.1** pins and set Client `versionNegotiation` to
`{mode:{pin:"2026-07-28"}}`, Flowmark's existing protocol profile. No production
auth/SDK pins changed. The reference AppBridge, iframe proxy, message relay and
CSP implementation remain upstream. The initial legacy request was rejected
rather than weakening Flowmark's protocol policy.

Observed on macOS in **Chrome 157.0.8103.40**, using only fixed synthetic data:

- Reference Basic Host v2.0.4 at the pinned source revision built with Vite
  **6.4.4**, then connected through Streamable HTTP. Its final temporary lockfile
  SHA-256 was `3f68d550dd3f85049f3719391245a6076c6ac609889f3ee290ae694679b074ef`.
- `get_run` rendered the shared snapshot with Completed status, 1.20 s recorded
  duration, two event references from a 20-event population, explicit omitted
  pages, and withheld application payloads. The host retained its complete
  structured/text result separately.
- Keyboard Shift-Tab/Enter selected the started event and updated its evidence
  reference/payload. Both host themes rendered; the host close action completed
  teardown and removed the view. The owned Chrome test window was closed.
- Inspected both iframe sandbox attributes and the actual sandbox HTTP CSP
  header. The upstream header allows same-origin connections; the view's
  additional hashed-script CSP restricts connections, images, frames and forms
  to none. These policies intersect. No active outbound-network attack was
  executed; the production bundle contains no evidence-fetch path, external
  asset references, eval constructs, private server imports or console calls.
- The synthetic fixture and patched host bound loopback only and were stopped.
  No hosted login, existing telemetry, model call or client configuration change.

Automated validation includes actual SDK transport rejection of unrelated source
windows, teardown/observer cleanup, invalid/cancelled-result clearing, page/scope
checks and byte bounds; SDK HTTP checks preserve complete non-UI fallback and
reject denied/unknown resource reads. Real disposable-PostgreSQL HTTP coverage
verifies authenticated resource reads, UI capability negotiation, disabled mode,
missing credentials and revocation. Root `pnpm check` and all 139 server
integration tests passed; the managed demo integration tests also passed.

Implementation paths/exports: `@flowmark/evidence-view/{projection,snapshot,resource}`,
`connectEvidenceView`/`projectToolEvidence`, MCP `registerRunEvidenceTool`,
`registerEvidenceResource`, `readEvidenceCapability`, and `runMcpResourceRead`.
The generated asset is 1,002,291 bytes at this verification stage (build cap 1 MiB).
Navigation and additional lifecycle features remain a separate task. Hosted
Preview, deployed-host interoperability and Codex/Cursor/Claude App support were
not tested or claimed.
