# ADR 0018 — Explicit business evidence projections

- Status: Proposed; maintainer approval required before changing permissions
- Date: 2026-11-13
- Tasks: Product TASK-010.1–010.4
- Baseline: staging `1941c46`, including accepted ADR 0017 / project sharing

## Purpose

An owner can invite a business reader who can investigate reported outcomes and
journeys without receiving raw diagnostic evidence. This is a server access
policy, independent of UI lenses, URLs and saved selections.

## Authority and publication

Keep the fixed owner and diagnostic `viewer` roles unchanged. Add one project role,
`business`, through the existing verified-email invitation flow. The owner chooses
and confirms the access level when inviting; the recipient reviews it before
accepting. Existing invitations and memberships remain diagnostic viewers.
Changing a member's level requires removal and a new invitation. No promotion,
owner transfer, workspace authority, anonymous links or entity-specific grants.

Business membership grants **project-wide activity metadata**: internal run IDs,
workflow names, reported status/outcome codes, observation/start times, recorded
durations and bounded aggregate counts. It does not restrict a person to one
customer. State that scope at invitation and acceptance; a customer reference in
a query is a filter, never an ACL. External application run IDs are withheld.

Properties, results and declaration labels are not safe merely because they were
reported by the application or declared for search. Owners must explicitly publish
the additional fields intended for business readers:

- At most 25 workflow/revision publication entries per project, each selecting up
  to the existing 12 declaration fields. Select exact immutable result revisions
  and paths; later declarations/imports do not publish themselves.
- Only declared count fields and category/reason fields with a finite declared
  value list may be published. Expose bounded nonnegative numeric values and the
  explicitly published category/reason vocabulary; omit unknown or invalid values
  with truthful coverage. Never forward an arbitrary result subtree.
- At most 10 declared reference keys per workflow. Publishing a key intentionally
  exposes its bounded values throughout this project. Never copy the remaining
  properties. New search fields do not publish themselves.
- The default publication is empty. Business readers can see project activity
  metadata, but no properties or result values until the owner publishes them.

Add a small owner-managed project publication record with a monotonic revision.
Validate choices against current stored declarations/search keys. Use an expected
revision on replacement so stale Settings tabs cannot overwrite newer policy.
Deleting a publication removes future access; it does not erase telemetry or
copies already downloaded. Explain that disclosure boundary in the owner UI.

## Field and route policy

| Surface/data                                                                                               | Owner / diagnostic viewer         | Business reader                                      | Stranger / removed member |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------- | ------------------------- |
| Project name, workflow names, run UUID/status/outcome/time/duration/counts                                 | Existing diagnostic access        | Project-wide bounded metadata                        | Denied                    |
| External run IDs, correlation IDs, release/environment and arbitrary step/unit text                        | Existing access                   | Withheld                                             | Denied                    |
| Published result values/reference values and selected declaration meaning                                  | Existing access                   | Exact publication only                               | Denied                    |
| Other result fields, props, errors/stacks/messages, operation details, raw events and expectation payloads | Existing access                   | Withheld                                             | Denied                    |
| Diagnostic snapshots, free-text search, technical filters/attributions and raw downloads                   | Existing access                   | Denied; use projected reads                          | Denied                    |
| Business lookup, journey, result insight and peer summary                                                  | Existing access                   | Projected response; only published selectors         | Denied                    |
| Keys, rename, declarations/imports, publication, invitations/roster and erasure                            | Owner only as today               | Denied                                               | Denied                    |
| Own live saved selection and own delegated read consent                                                    | Existing personal ownership rules | Allowed, but reopening rechecks projected access     | Denied                    |
| Personal project creation and account controls                                                             | Existing personal rules           | Existing personal rules; never the invited workspace | Own account only          |

Owners and diagnostic viewers retain their current responses. Read keys remain
independent diagnostic credentials; business readers cannot create or retrieve
one. A supplied key is not converted into restricted business membership. Browser
write keys do not gain any read authority.

## One reusable server boundary

`packages/api` owns the admission and allowlist projection contract. Persistence
owns current membership, active-account/project/grant checks, publication reads
and their transaction fences. Protocol shells do not invent redaction policies.

Use a versioned, explicitly constructed `BusinessEvidence` discriminated DTO;
never serialize a diagnostic object and delete a few known secret properties.
Project activity, run summaries, journeys, result insights and comparisons share
the same DTO/projection primitives. Preserve bounds, cohort/window/revision,
reported-evidence semantics, coverage and truncation. UI components consume only
the supplied projected DTO, including any portable view.

Legacy diagnostic routes reject business membership before reading raw records.
Expose projected business reads through a small API use case and thin Studio
adapter; diagnostic users may use those views too. Audit **every** existing
`GetProjectWorkflowData` method, declaration/meaning endpoint and saved-selection
path so business membership cannot reach a raw alternate path.

The six existing MCP tool names stay unchanged. Discovery, find, run summary,
business insights and peer summary use the shared business projection for a
business subject. Technical sections/modes return explicit withheld/denied states,
not empty diagnostic pages. The MCP App resource and its text/JSON fallback consume
the same projected DTO; refreshing/paging rechecks current authority. Do not
register a diagnostic resource containing richer data for a business response.

Public key-authenticated SDK/HTTP reads keep their diagnostic contract. Tokens,
project headers or cookies cannot turn a business subject into a key reader or
unrestricted delegated user. Export/copy uses the already projected DTO; no
client-side diagnostic fetch precedes business rendering or export.

## Denied, withheld and absent

- **Denied:** no current project/grant authority, forbidden route or a selector
  that asks for unpublished/diagnostic data. Do not execute a hidden-field filter
  and leak its answer through counts, cursor behavior, ordering or error text.
- **Withheld:** an otherwise authorized business response identifies an excluded
  section using constant capability metadata, without its values, names or counts.
- **Absent/unavailable:** permitted evidence is genuinely missing, invalid,
  expired or not observed. Preserve that reason and coverage; never fabricate
  zeroes, a successful outcome, or an empty page to conceal a permission decision.

Reject mixed diagnostic/business filters and unsupported scope. Cursors must be
bound to the projected query/project/publication revision; a stale publication
requires a fresh first page. UI caches include identity/project/depth/publication
revision and clear sensitive detail on membership or policy change.

## Revocation, lifecycle and later snapshots

Resolve native session or verified delegated subject on the server; derive depth
from current membership, never request input or a token's cached role. A delegated
read additionally intersects its existing project grant. Recheck membership and
publication under the same project fence as the read, including delayed requests.
Owner publication writes serialize with reads/removal/erasure. Bound locks and
statements; preserve the existing user-before-project lock order.

ADR 0015/0017 lifecycle remains: no owner erasure with other members, viewer/business
account erasure only detaches their shared memberships, and removal deletes this
project's delegated bindings without reviving them on rejoin. Apply those rules to
both read-only roles. Pending invitations store their exact level and are revoked
by the existing email/account/project rules.

Projection metadata records version, depth, project, publication revision and
observation/coverage context. Future captured evidence must intersect its stored
selection with **current** authority/publication when read or exported. This ADR
adds no snapshot storage, retention extension or public sharing route; TASK-005.3
still owns that separate lifecycle decision.

## Implementation and acceptance

Deliver TASK-010.2–010.4 together after approval: closed role/invitation schema,
publication storage and guarded Settings, shared projected reads and explicit
raw-route denial, useful Studio/MCP/portable presentation and bypass audit. Include
schema, generated SQL/metadata and migration tests. Existing roles/invitations
must remain unchanged; do not edit applied migrations. Old binaries cannot be
used with business memberships if they assume all members are diagnostic readers.

Use owner, diagnostic viewer, business reader and stranger across two projects.
Place synthetic canaries in external IDs, properties, result siblings, errors,
operations, expectation payloads, free text and hidden filter values. Exercise
native routes, all six tools, resource refresh, direct API, exports, saved
selections and key/delegated boundaries. Test current and delayed removal,
publication restriction, stale cursor/configuration, rollback, account erasure,
equal references across projects and unchanged owner/diagnostic behavior. Browser
check one real business outcome/journey question, withheld/missing recovery,
keyboard/mobile and cache transitions. Do not claim a business reader is enabled
until this matrix is green.

Approval accepts this concrete first version for local code and disposable tests.
It authorizes no real invitations, hosted migration, merge, deployment, external
model call, new dependency or publication.
