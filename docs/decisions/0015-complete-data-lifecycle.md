# ADR 0015: Complete data erasure with bounded, resumable cleanup

- Status: accepted by maintainer on 2026-11-12
- Date: 2026-11-12
- Tasks: Access TASK-006–009; implementation begins with TASK-007
- Inspected baseline: staging `97090b2db7505739687814d4595d517faf097a1e`,
  schema and migrations through 0023

The maintainer explicitly approved “Approve the lifecycle contract.”
Implementation and disposable local verification are authorized.

## Authority and scope

A user is the application identity. Better Auth's `account` is a credential,
not an owner. Project authority comes from an explicit `project_members` owner
row. A workspace is presently a grouping, with no owner; the first membership
never confers workspace authority.

For this increment, destructive project operations require exactly one member,
whose role is owner and whose identity is the requester. Unexpected multiple
members/owners block the operation without changing anything. Account deletion
also blocks if any membership is shared or not owner. Collaboration's later
ownership/transfer contract must explicitly supersede these restrictions.
An empty workspace is removed only after its last project is deleted, under a
workspace row lock shared by project creation. Nonempty groupings survive.

Operations are distinct:

- **Erase telemetry:** explicit run IDs (maximum 100) or a named workflow and
  inclusive lower/exclusive upper run-start interval. Remove complete runs,
  including every event, expectation and fact, regardless of event timestamp.
  Keep workflow identity, declarations, search configuration, import receipts,
  memberships and private live selections. Reopening a selection can be empty.
- **Delete project:** remove all project-owned evidence, configuration, keys,
  membership, private selections, import receipts and grant-project bindings.
  Other projects and their OAuth access remain untouched.
- **Delete account:** coordinate deletion of solely owned projects first, then
  user-owned auth/personal records. An empty account is supported. Never delete
  another user's project because it shares a workspace.
- **Personal export:** only the user's profile, memberships, private selections
  and safe connection metadata. Membership alone does not export project data.
- **Project export:** an owner-authorized export of that project's complete
  evidence and configuration; exclude private selections belonging to others,
  credentials, password hashes, signing material, tokens and rate-limit keys.

Exports are future TASK-009, not a prerequisite falsely presented as an existing
download. Deletion explicitly warns when an export facility is unavailable.

## Confirmation, snapshot and write fence

Require a current session and a server-verified password reauthentication proof
at most five minutes old, bound to immutable user/session/project, operation
kind and preview ID. Proofs are single use. A typed project name plus the exact
scope confirmation is additional consent, never authority. Account deletion
requires the exact phrase `DELETE MY ACCOUNT`. Do not accept bearer ingestion
keys or delegated OAuth tokens for these operations.

A preview expires after five minutes. It contains immutable scope, creation
cutoff, counts of runs/events/keys/configuration, the ingestion consequences and
the current ownership revision. Count work uses a five-second statement budget;
an incomplete estimate is labelled and cannot silently become an exact count.
Confirmation rechecks ownership, project name, lifecycle and source revision in
the fencing transaction. A stale preview requires a new preview. Freeze selected
run IDs or the reviewed workflow/time interval plus server creation cutoff;
later-created runs never enter an already confirmed selection.

Every ingestion transaction takes the project lifecycle lock **before** creating
a workflow or accepting duplicate events, and rechecks the actual key's validity
inside that transaction. Management writers and private-object writers take the
same lock and reauthorize. Confirmation takes the conflicting lock, changes the
lifecycle state and invalidates **all server API and browser keys** atomically.
This includes read keys: no retained credential can outlive this boundary.
Use a project credential epoch or equivalent constant-size revocation fence;
do not update an unbounded population of key rows in the fencing transaction.
Remove invalidated key rows in the subsequent bounded cleanup phases.
Already-authorized HTTP requests must still fail at the persistence boundary.
Normal reads deny a purging project; operation preview/status/resume remain
available only to its authorized owner. A partially purged project is never
shown as an ordinary usable project.

For telemetry erasure the project becomes usable again only after completion;
owners must explicitly create replacement keys. Existing unselected runs can
continue with those new keys. A permanent, payload-free **new-run timestamp
floor** is advanced to the greatest of its previous value, confirmation time,
and selected runs' `started_at`. New run creation at or below that floor is
rejected, including replayed `started` envelopes. Existing unselected runs are
looked up first and do not become newly created runs. The preview warns that
buffered/historical starts predating this boundary will no longer be accepted
anywhere in the project, and that future-dated source clocks can delay new
starts. This deliberate post-erasure restriction avoids indefinite per-run
identifier tombstones and does not age out or delete other stored evidence.
Keep the floor until project deletion; it contains no run IDs or payloads.

Run IDs remain application-reported evidence: a newly authorized producer can
submit new evidence with a new timestamp, including reusing an application ID.
This is not proof against an owner deliberately reimporting erased content.
Original buffered envelopes and old credentials cannot recreate it. There is no
SDK payload redesign, automatic credential distribution or retention extension.

## Durable work and bounded requests

Use PostgreSQL lifecycle-operation rows and an explicit authenticated resume
endpoint in the existing stack. No queue dependency, serverless after-response
Promise, timer or customer-workflow execution is introduced.

State transitions: `previewed → fenced → purging → live_data_deleted`.
`previewed → cancelled/expired` is allowed. Once fenced, only resume is allowed;
no rollback to an ordinary partially deleted project. A failed batch records a
sanitized failure code and remains fenced, retryable and visibly incomplete.
Cancellation before fencing has no side effects and does not revoke keys.

One active operation per project, unique request/preview identity, immutable
actor/target IDs and a versioned scope prevent duplicate or widened jobs. Store
only IDs, scope, phase, counters, timestamps and sanitized failures, not evidence
payloads or key material. Lock the operation row per batch; concurrent retries
serialize. Reauthorize the original owner and ownership restrictions on every
resume. Membership/ownership mutations cannot race an active lifecycle.

One request executes at most one batch: at most 100 runs, 1,000 events or 100
configuration/auth rows, a five-second statement timeout and ten-second request
work budget. A single large run is removed across event batches while the whole
project remains inaccessible; final run deletion follows event/expectation
cleanup. Never cascade an unbounded event population from a run/project row.
Small requests finish in their initial batch only when within those same
limits. Partial progress is committed transactionally with its phase/counters.
The UI can request subsequent batches while open; closing it safely pauses work.
Status clearly says when another resume is required. An explicit operator resume
uses the same immutable scope and documented authority, not a generic SQL eraser.

Delete events/expectations in their cyclic FK-safe order, then metric/run facts,
then runs, workflows and project children, then the project. Account cleanup
must not accidentally turn a leaf batch into an unbounded cascading delete:
clear cyclic expectation references in bounded steps, and explicitly drain
high-cardinality children before deleting their parents. Account cleanup
uses this primitive, invalidates normal sessions/recovery at fencing and exposes
only a random, hashed-at-rest, status/resume capability bound to that operation;
it cannot read evidence, change scope or create resources. The UI prepares and saves this capability at preview, before any access is
disabled; it is admitted only after confirmation, including lost-response
recovery through the standalone privacy page. Capability expires
after 24 hours from confirmation; authenticated operator recovery remains possible without email
matching. Finish credentials, tokens, verification and user deletion last.
Provider HTTP, callback and server deletion entry points must all use or reject
in favor of this coordinator. A completion notice is optional and is never a
condition for claiming live-data deletion; failed delivery remains visible.

## Current schema inventory and treatment

`T` means complete-run lifetime (reference target 30 days, cleanup not yet
scheduled). `P` means project lifetime. `U` means user/account lifetime.
Exports below always exclude secrets and unrelated people. These are ownership
rules, not assertions that all physical expiry jobs already exist.

| Current table/object                                    | Authority/lifetime                      | Erasure and safe export treatment                                                                                                                                                           |
| ------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data_lifecycle_operations` (TASK-007 addition)         | immutable requester/target + cleanup    | Versioned scope/progress; live owner only, terminal redaction and thirty-day expiry; unfinished work stays fenced; excluded from telemetry/project exports                                  |
| `account_lifecycle_operations` (TASK-008 addition)      | immutable user + cleanup                | Versioned parent progress and hashed 24-hour recovery capability; no profile FK; no email/payload; thirty-day terminal expiry; unfinished work stays fenced; excluded from exports          |
| `workspaces`                                            | grouping                                | Delete only if empty under lock; project export includes grouping name only                                                                                                                 |
| `projects`                                              | explicit sole owner / P                 | Delete last; export own metadata                                                                                                                                                            |
| `workflows`                                             | project / P                             | Retain on telemetry erase; delete with project; export definitions                                                                                                                          |
| `workflow_runs`                                         | project / T                             | Complete selected run deletion; export evidence                                                                                                                                             |
| `workflow_events`                                       | run / T                                 | All event kinds, errors, properties, results and relation references go with run; export evidence                                                                                           |
| `workflow_run_facts`                                    | run / T                                 | Remove with raw evidence; never a longer-lived archive; export derived evidence with provenance                                                                                             |
| `workflow_metric_facts`                                 | event/run / T                           | Same rule as run facts                                                                                                                                                                      |
| `workflow_expectations`                                 | run / T                                 | Remove cyclic event references safely with complete run; export reported expectation evidence                                                                                               |
| `project_api_keys`                                      | project / P                             | Invalidate at fence, delete with project; export metadata only, no hashes/secrets                                                                                                           |
| `project_browser_keys`                                  | project / P                             | Same; inline minute counters disappear with key, not independent history                                                                                                                    |
| `project_members`                                       | project + user / P/U                    | Remove on either deletion; export own membership, no colleague personal fields                                                                                                              |
| `saved_investigations`                                  | private user + project / P/U            | Cascade on either deletion; retain on telemetry erase; only owner exports                                                                                                                   |
| `workflow_result_declarations`                          | project / P                             | Retain on telemetry erase; delete with project; export schema/provenance                                                                                                                    |
| `workflow_search_fields`                                | project / P                             | Same, including field-source metadata                                                                                                                                                       |
| `workflow_definition_imports`                           | project / P                             | Delete with project; account deletion nulls actor; export receipt/provenance without unrelated identity                                                                                     |
| `user`                                                  | immutable user / U                      | Profile/onboarding erased last; personal export excludes credentials                                                                                                                        |
| `account`                                               | user's provider credentials / U         | Delete credentials/provider tokens; never export secrets                                                                                                                                    |
| `session`                                               | user / max configured expiry            | Invalidate at account fence; purge all on completion; safe personal session metadata only                                                                                                   |
| `verification`                                          | provider purpose/subject / token expiry | Identify and remove subject-bound reset/verification artifacts before user removal, despite absent FK; never export token/value                                                             |
| `auth_rate_limits`                                      | service security state                  | No user FK; HMAC/digest identifiers, at most 15-minute logical windows, physical pruning traffic-driven; no export as personal credentials; restored expired counters never regain validity |
| `agent_access_grant_projects`                           | grant family + project / P/grant        | Remove project binding; other projects' grant access survives; orphan family bindings removed on account revocation; safe allowlist metadata export                                         |
| `agent_access_oauth_consent_intents`                    | user + client/consent / U/grant         | Invalidate pending affected consent on project fence; delete on user/client/consent removal; safe own metadata only                                                                         |
| `agent_access_connection_last_auth`                     | user + client/family / U/grant          | Delete on account/family cleanup; coarse own connection metadata export                                                                                                                     |
| `oauth_client`                                          | registering user or service             | User-owned clients deleted on account purge, including affected grants; service-owned clients survive; never export client secret                                                           |
| `oauth_resource`                                        | service                                 | Survives individual deletions; no user payload export                                                                                                                                       |
| `oauth_client_resource`                                 | client/resource                         | Remove with owning client; service mappings survive; safe configuration only                                                                                                                |
| `oauth_refresh_token`                                   | user + grant family                     | Revoke at account fence and purge on completion; expiry/replay windows enforced; no tokens/replay response export                                                                           |
| `oauth_access_token`                                    | user/client/grant                       | Same; session deletion alone is insufficient because FK sets null; no token export                                                                                                          |
| `oauth_consent`                                         | user/client                             | Remove account-owned consent; project purge invalidates affected pending scopes without widening remaining grant; safe own scopes only                                                      |
| `oauth_client_assertion`                                | service replay protection               | Expiry-bound, no user FK; prune expired replay IDs; never export                                                                                                                            |
| `jwks`                                                  | service signing identity                | Never delete for one user/project; rotation/expiry managed separately; no private key export                                                                                                |
| `workflow_events_project_facts` trigger                 | event projection                        | AFTER INSERT, calls `flowmark_project_event_facts`; insert fence prevents reprojection during purge                                                                                         |
| `flowmark_project_event_facts()`                        | projection function                     | Current 0016 implementation; no DELETE trigger; do not disable integrity globally                                                                                                           |
| `flowmark_rebuild_run_facts(uuid)`                      | projection rebuild                      | 0015 implementation; gone runs cannot rebuild; bounded purge removes all raw inputs before releasing fence                                                                                  |
| `workflow_event_type`, `oauth_consent_intent_state`     | service enums                           | Schema metadata survives; no personal payload                                                                                                                                               |
| indexes, constraints, receipt sequence, Drizzle history | service schema                          | Retain schema/history; indexes follow rows; receipt gaps reveal no evidence and are not reset                                                                                               |

No persisted SQL views/materialized views exist at this baseline. API/Studio
summaries, comparisons and timelines are queries over the owned rows, not extra
retention stores. `flowmark_guard_project_lifecycle` and `flowmark_guard_account_lifecycle`
serialize admission with project/account fences. They retain leaf-first cleanup
and original projection triggers. Account erasure may null only its import-receipt
actor reference in another fenced project, with all other fields unchanged.
Revocation may also remove its own subject/client grant bindings in an
independently fenced project; it cannot create bindings or change project data.

New schema objects must extend this inventory before rollout.

## Operational copies, expiry and restore

| Copy                               | Contract and owner                                                                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live database                      | Purge as above; account data is not on the telemetry 30-day timer. Maintainer owns cleanup operation completion.                                                                                                                                                                      |
| Browser/query cache                | Clear target project/user caches and selection on fencing/completion; responses are private/no-store. Previously downloaded copies on others' devices cannot be remotely erased.                                                                                                      |
| Email provider and delivered inbox | Recovery/verification links currently expire in 30 minutes. Provider message bodies/delivery logs need processor-specific erasure and retention handling; recipient inbox copies are outside app control. Maintainer must confirm provider retention before a hosted privacy promise. |
| Hosting/function/CI logs           | Never intentionally log credentials/payloads. Provider-configured expiry and support erasure process require maintainer verification; application deletion does not claim to delete provider logs.                                                                                    |
| Support records                    | No support store in this schema. Maintainer inventories actual ticket/mail copies and exceptions before closing an external erasure request.                                                                                                                                          |
| Future exports                     | Private authenticated delivery, no secrets; artifact lifetime at most 24 hours, immediate invalidation on owner/project fence. Persisted artifact storage is a separate approved task; no public download URL.                                                                        |
| Database PITR/backups              | Last operator record reports six-hour PITR, not freshly verified here. Actual backup expiry must be read before rollout; do not promise immediate backup deletion or change paid retention.                                                                                           |
| Local demo/test data               | Existing user data untouched. Tests use disposable synthetic Compose databases; no customer dumps.                                                                                                                                                                                    |
| Source/releases/npm                | No customer telemetry belongs here. Historical accidental disclosures require incident handling, not a false promise that row deletion rewrites published artifacts.                                                                                                                  |

Terminal operational rows expire after 30 days; expired previews after 24 hours;
unfinished cleanup never expires into an unlocked resource. Account completion
removes ordinary actor/profile fields, retaining only minimal immutable target IDs,
operation timestamps and suppression status for at most 30 days. A separately
controlled suppression ledger must cover every deletion since the oldest
recoverable backup; retain it until that backup is no longer recoverable plus
24 hours, bounded by the approved 30-day operational window. If backup retention
exceeds that bound, rollout/restore is gated on a reviewed policy change.
No email, payload, key or reversible profile is needed in that ledger.

Restore is an offline operator procedure: restore into isolation, deny app/key
access, replay the independently preserved suppression ledger, expire old
verification/session/token material and expired rate counters, verify purges,
then explicitly approve cutover. A ledger restored from the same old backup is
insufficient. If the ledger or provider expiry evidence is unavailable, restore
must remain isolated; never resurrect erased access to meet availability goals.
Backup machinery and cleanup scheduling remain infrastructure tasks, not silent
dependencies claimed complete by a local feature PR.

## Worked traces

1. **Small success:** owner previews two runs, reauthenticates and confirms.
   Transaction fences project/revokes keys/freezes scope; one bounded batch
   removes events/expectations/facts/runs. Completion unlocks retained settings;
   owner creates fresh keys. Unselected project B remains unchanged.
2. **Large run:** a run with 50,000 events remains behind a fence while batches
   remove at most 1,000 events. Closing Studio pauses it; reopening status and
   resuming continues the same operation and cutoff. No unbounded cascade.
3. **Failure:** batch three times out; transaction three rolls back, previous
   progress remains durable. Status reports incomplete/retryable. Old credentials
   and normal reads stay denied. Resume rechecks owner and continues.
4. **Concurrent ingest:** an earlier writer holds the shared project lock;
   confirmation waits, then rechecks preview and can demand a refreshed preview.
   After fencing, a request authenticated earlier cannot insert anything. After
   completion, old keys fail and replayed old starts fail the timestamp floor.
5. **Shared ownership:** a second membership appears before confirmation;
   sole-owner check fails. No key revocation or purge occurs. Account deletion
   reports the blocking project rather than inferring ownership from workspace.
6. **Restore:** operator restores a pre-erasure timestamp into isolation,
   reapplies newer suppression records, invalidates restored auth material and
   checks all raw/derived rows before any proposed cutover. No ledger means no
   cutover; a Vercel app rollback is not a database restore.

## Acceptance and remaining gates

Maintainer acceptance covers the sole-owner restriction, key invalidation,
post-erasure timestamp floor, batch/resume behavior and proposed operational
lifetimes. It authorizes implementation and disposable local tests only.
No real deletion, hosted migration/deployment, provider setting, backup restore,
new service, scheduled cleanup or external notice is authorized by this ADR.

The maintainer owns provider retention verification, recovery-ledger operations
and exceptions; qualified legal/privacy review must determine controller versus
processor obligations, identity/access/portability distinctions, lawful holds and
support-copy handling. These remain explicit hosted operational gates. This ADR
does not claim GDPR compliance or that technical deletion resolves every legal
request. TASK-007 owns project implementation, TASK-008 account/provider guards,
TASK-009 export delivery, collaboration tasks future shared-owner policy, and
existing infrastructure cleanup/recovery tasks scheduling and restore drills.

### Shared live questions (ADR 0019)

Migration 0029 adds `shared_investigations`: intentional title/selection metadata,
not copied telemetry. Immutable creator/project ownership and a membership FK
remove a creator's copies on leave/removal without reviving them on rejoin.
Project/account cleanup drains these rows alongside private questions in the
existing saved-question phase (at most 25 shared and 75 private rows per batch),
preserving persisted phase numbers. Creator account cleanup can delete only its
own shared rows inside another fenced project. Source run erasure does not erase
a live question; reopening still reads retained evidence and may be unavailable.
Project/account deletion does erase the owned question metadata. No captured
result or additional retention store is introduced by this increment.
