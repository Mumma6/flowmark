# ADR 0019 — Authenticated investigations and bounded evidence captures

- Status: Accepted for local implementation (maintainer approval, 2026-11-13)
- Date: 2026-11-13
- Task: Product TASK-005.3; consumers TASK-005.4–005.6
- Inspected baseline: staging `13130b0`, including ADR 0018 / business evidence

## Decision boundary

Share a saved question with colleagues who already have project access. Separately,
capture one bounded business run observation for later inspection. Neither an
object ID nor a URL grants membership, a delegated grant, diagnostic depth or
longer evidence retention. Existing private selections remain private and live.

This decision defines application behavior, not a new telemetry archive, public
share service, infrastructure dependency or authority model.

## Shared live questions

A current native-session member may explicitly publish an immutable copy of their
own validated question and a title. Publishing never changes the private original.
The UI discloses that the copy is visible to current and future project members
whose evidence depth permits it. Titles are deliberately authored shared text,
not generated from hidden telemetry; keep the existing 120-character bound.

Each copy has immutable project/creator IDs, internal UUID, creation time,
selection version and one explicit maximum evidence depth:

- **Diagnostic:** existing `SavedSelection` run/period/linked selections, readable
  only by current owners/diagnostic viewers. Business readers cannot publish,
  list its title or inspect its selection. Preserve exact supported selectors.
- **Business:** version-1 `BusinessEvidenceQuery`, readable through the same
  published-field boundary for every recipient, including diagnostic recipients.
  Validate published paths, reference namespaces and filters before disclosure.
  Publication must still permit the selection on every later list/open/export.

This ceiling restricts a view; it never grants access. A business recipient does
not receive a diagnostic selection and then redact it in the browser. Unsupported
conversions from a private question fail explicitly. Sharing starts at the first
page: reject supplied cursors rather than silently discarding them. Keep absolute
windows; relative peer days remain explicitly live and recompute when opened.

Live copies store no result bodies. Selection JSON is capped at 16 KiB; a project
holds at most 100 shared questions, with at most 25 per creator. Lists return at
most 25 permitted items and no hidden-object counts. Pagination binds project,
reader, evidence depth and current publication revision. Apply permission and
selector checks before returning titles, values, continuation metadata or errors.
Questions have no automatic expiry; referenced data can disappear independently.
User-authored selections/titles are intentional metadata, not retained results.

The creator may revoke their copy; the project owner may revoke any copy. Ordinary
recipients cannot edit/delete another member's copy. Revoke deletes the shared
copy immediately and leaves private originals and source telemetry intact. There
is no update, ownership transfer, recipient ACL or anonymous bearer link.

## Captured evidence: one business run only

Capture is an explicit native-session action by a current member. It can start
from a permitted run question or direct run selection. Always call the server-owned
business projection, even for an owner. Never accept a browser-provided result,
diagnostic snapshot, event page, arbitrary JSON or client-selected access depth.

Version 1 captures only the `BusinessEvidence` envelope with `data.kind = run`:
internal run metadata, exactly published result fields/reference values, publication
revision, observation time, constant withheld sections and typed missing/invalid
states. Preserve each field's immutable declaration revision. Add server capture
ID/time, creator/project/source-run IDs, expiry and the explicit description
“single run observation; raw events, operations and other evidence omitted.”
No aggregate/journey capture, arbitrary result subtree, raw diagnostics or secrets.
Later multi-run capture needs a complete bounded source-dependency contract.

The complete persisted capture, including title and envelope, is at most 64 KiB;
reject oversize rather than silently truncating it. Maximum 20 captures per creator
and 100 per project. Count unpurged expired rows toward limits. List pages contain
at most 25 readable metadata records; content is fetched individually. Captures
are project-shared at business depth, immutable, and deletable by creator/owner.

## Lifetime and current authorization

`capturedAt` and all deadline decisions use server/database UTC time. Hard expiry
is the earlier of capture time plus 24 hours and source retention deadline. For
the reference 30-day policy, conservatively cap that deadline at the earlier of
run `startedAt + 30 days` and database `createdAt + 30 days`; never infer a new
30-day allowance from capture or a late-arriving event. An approved shorter source
policy takes precedence. Refuse an already-expired source or unknown safe deadline.
This cap is a conservative capture limit, not a new claim about cleanup coverage.

Every list/read/export rechecks current recipient and creator membership, active
accounts/project, object existence and applicable depth. Native identity and
verified delegated reads use current authority; delegated reads additionally
intersect the existing live project grant. Read/write API keys and browser keys
cannot manage or fetch saved objects. They retain their separate live-read rules.

A capture also requires all of the following, checked under the read fence:

- The exact source run still exists in the same project and is not under erasure.
- Database time is strictly before stored expiry and the current safe deadline.
- Current publication revision equals the captured revision. Any publication
  change invalidates the capture; do not revive it if fields are later republished.
- The stored schema/version/projection validates. Corruption fails closed.

An invalidated capture never falls back to live evidence. Offer a separate action
to reopen the live question and explicitly capture a new observation. Ordinary
lists omit inaccessible objects. An authorized creator/owner may obtain minimal
ID/time/unavailable status for cleanup, without the old title/selection/payload.
Foreign, missing, revoked and unauthorized IDs have one nondisclosing response.
Expired/source-missing/policy-changed detail is available only after that minimal
authority check. No unavailable state fabricates a successful or empty result.

Removing/leaving membership must atomically revoke that creator's shared questions
and captures along with existing project grant bindings. Old IDs stay unusable
on rejoin; a fresh share requires a new action. Recipient removal immediately
blocks subsequent reads. Account deletion drains the creator's objects; project
deletion drains every object. Other projects and private-object semantics remain
unchanged. Delivered/downloaded copies cannot be recalled.

## Transactions, deletion and export

Use the existing user-before-project lock order and live member/grant/publication
fences. Capture projects and inserts inside one transaction while holding its
source run lock; a client read followed by a separate insert is insufficient.
Serialize quotas, revocation, publication changes and erasure with that fence.
A read admitted first may finish with its past observation; a removal/restriction
committed first must deny a delayed read/capture. No success-shaped DB fallback.

Store captures with project, creator and source-run ownership/FKs. Extend the
existing data/account lifecycle inventory and bounded cleanup before admission:
run erasure deletes dependent captures before its run; account erasure drains
creator objects; project erasure drains all. Never reorder persisted erasure phase
numbers or reinterpret unfinished operations without a migration/version plan.
FK cascades are a final integrity guarantee, not the bulk cleanup implementation.

Expiry denies reads immediately even if physical purge is delayed. TASK-005.6
must supply bounded, resumable physical expiry cleanup and deletion integration;
expired rows are not a recoverable archive. Hosted capture admission remains off
until that integration and its operating cadence are reviewed and verified against
source-retention deadlines. This ADR installs/activates no scheduler or provider
setting and does not promise physical deletion at a deadline from a read-time TTL.
Any needed hosted scheduling uses the existing infrastructure writer and approval.

Export reuses the authorized object-read DTO, with capture/observation/expiry,
coverage and withheld metadata intact. A live export says that it recomputes;
a capture export says that it is a past observation. Existing diagnostic clipboard
exports are not a persistence format. No public download URL, upload, persisted
export artifact or complete account/project portability endpoint is introduced.
Backup/restore suppression and external-copy limits remain governed by ADR 0015.

## Concrete implementation handoff (planned, not existing APIs)

- Core: versioned `SharedInvestigationSelection` discriminating diagnostic
  `SavedSelection` from business `BusinessEvidenceQuery`; strict command/read DTOs
  and `CapturedRunEvidence` containing only the approved business run envelope.
- API: `ManageSharedInvestigations` and `ManageEvidenceCaptures`, with typed
  repositories and failures. Extend the existing business read/projection seam to
  persist within its transaction; never store a diagnostic response and redact it.
- DB: separate `shared_investigations` and `evidence_captures` tables, leaving
  `saved_investigations` unchanged. Immutable ownership/depth/content, bounded
  quota writes, scope-bound keysets, current creator membership and source checks.
- Server: thin `sharedInvestigations` / `evidenceCaptures` routers. Management is
  native-session-only with trusted Studio mutation guards; object reads accept
  verified native/delegated project subjects, never unverified header identities.
- Studio: explicit share/capture disclosure; authenticated object URLs containing
  UUID/project only; live versus captured labels, revoke/delete and recovery.
  Reuse supplied `BusinessRunView`; never give captured data to `RunSnapshot`.
- Existing six MCP tools stay six. This task adds no saved-object MCP tool/resource.
  Portable supplied business views must preserve capture labels if later supported;
  until then, offer the authenticated Studio capture URL, not a falsely live view.
- TASK-005.4 owns shared live API/UI; 005.5 owns local capture/read API/UI;
  005.6 owns expiry/erasure/export composition. Do not enable hosted capture in
  005.5 while 005.6 is incomplete. All schema changes include generated metadata.

## Worked acceptance traces

1. A viewer shares a diagnostic period. Another viewer reopens the exact windows
   using their own session. A business member/stranger cannot see its title/query.
2. A business member shares a published customer journey. Each recipient must
   still pass current publication checks before seeing its reference value. A
   diagnostic user cannot create a business share with a hidden release filter.
3. An owner captures a run with public count and private error/result siblings.
   Storage, API, UI and export contain only the server-projected count/metadata.
   A wrong primitive stays wrong-type; Completed does not mean all items succeeded.
4. Publication changes during capture: whichever fence commits first determines
   admission. A capture from the previous revision is unavailable on subsequent
   reads, even if a later publication happens to contain the same paths.
5. Source deletion/retention happens before capture commit: insertion fails. If
   capture commits first, source cleanup drains it; snapshots cannot outlive the
   source. An old late-arriving run gets no renewed retention allowance.
6. Reader removal, creator removal or unshare commits before a delayed request:
   no object/title/payload escapes. Rejoin and a surviving token do not revive IDs.
7. The clock reaches expiry: read/export deny immediately; cleanup can resume in
   bounded batches after a failure. No background cleanup is claimed installed.
8. Creator account or project erasure fences all reads, purges owned copies and
   preserves unrelated projects. Cross-project equal run/reference values never
   satisfy the source FK or authorization. A restored expired capture stays denied.

## Acceptance

The maintainer accepted these disclosure, role, storage and lifetime choices on
2026-11-13 with “Approve the contract.” Acceptance authorizes local implementation
and disposable synthetic tests in TASK-005.4–005.6 only. It authorizes no real sharing/capture, hosted migration,
retention cleanup, restore, dependency adoption, upload, merge or deployment.
