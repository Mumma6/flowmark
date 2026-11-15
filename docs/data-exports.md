# Account and owner project exports

Studio → Settings → Data & privacy → **Download your data** provides two distinct
exports. A diagnostic clipboard copy or portable snapshot is a limited view, not
an account or project export. Source implementation and deployed availability
are separate; this feature requires migrations 0034–0035 and the matching application.

## Scope

**My account personal data** includes your profile, safe provider-account metadata,
memberships, personal-workspace binding, your private saved selections, safe own
OAuth client/consent configuration and connection/grant-project metadata. It does
not include project telemetry merely because you belong to a project, or another
person's profile/private selections.

**Selected project data** requires the current fixed owner. It includes project
settings, workflows, runs, raw events, expectation reference/state metadata,
result declarations, search configuration, import receipts, membership/invitation
metadata, safe API/browser-key metadata, publication configuration, shared live
selections and the requester's private selections. It excludes other users'
private selections. Rebuildable run/metric rollups and captured business-projection
payloads are excluded; use their existing authorized product views separately.

Both scopes use positive column allowlists. Password hashes, session tokens,
OAuth credentials, verification values, API/browser-key secrets and hashes,
signing material and security/rate-limit state are never selected. Application
payloads in a project export can still contain sensitive data submitted by your
application. Backups and provider logs are not part of these live-data exports.
An ordinary product export is not a legal portability determination or proof of
business correctness. Flowmark never executes the observed application work.

## Request and download

1. Select the scope and acknowledge the local-file privacy warning.
2. Confirm your current password. Provider verification uses the existing shared
   reauthentication budget (five attempts per user per fifteen minutes).
3. Download the numbered NDJSON part. Small exports fit one part; larger exports
   expose **Download next part**. There is no background job, polling or email.
4. Keep all sequential parts through the final `complete: true` marker. Closing
   Studio pauses retrieval. In the same browser session, reopening the scope can
   retry the last requested part; only that part and its continuation are valid.

Requests expire fifteen minutes after preparation. Current browser-session,
account, project lifecycle and ownership checks run during each batch and again
before delivery. Cancellation, expiry, session revocation, ownership loss or an
account/project deletion fence denies subsequent delivery. Ingestion keys and
delegated agent tokens cannot initiate or retrieve an export. The request ID and
cursor alone grant no access. Requests use authenticated POST bodies, not secret
URLs. No export file or evidence payload is stored on the server.

Retried parts read live values again; their checksums can change. A failed,
interrupted or oversized part is incomplete and retryable with its original
cursor. The cursor is advanced transactionally, and one preceding cursor is
retained for lost-response recovery. Out-of-order or older cursors fail rather
than silently skipping evidence. Canceling does not recall downloaded files.

## Format, bounds and consistency

Each UTF-8 `.ndjson` file contains a version-1 `manifest`, zero or more
`{ "category": "table_name", "data": { ... } }` records and one `part-end`.
Database field names are snake_case; IDs remain strings, timestamps use their
stored PostgreSQL JSON representation, and 64-bit event receipt/progress integers
are decimal strings to preserve precision. The manifest identifies request,
scope/project, cutoff, observation time, part, categories and exclusions.

`part-end.sha256` hashes every preceding byte in that file, including line endings;
the HTTP `Content-Digest` hashes the whole response. Downloads have `no-store`,
attachment, `nosniff` and no-referrer headers. Studio verifies the whole-response
digest before offering a file. A missing final record, digest mismatch, missing
part or `complete: false` does not establish a complete export. `complete: true`
means traversal reached the last category, not a point-in-time database snapshot.

One batch selects at most 101 candidate rows at a time, emits at most 100 records
and approximately 1 MiB of record bytes plus bounded manifest/footer metadata.
Individual records above 256 KiB fail explicitly without being dropped. SQL
statements have a five-second budget, lock acquisition three seconds, and the
transaction a ten-second budget. No unbounded aggregate or offset scan is used;
the persisted position uses category and primary-key continuation. Concurrent
retries serialize on the request row.

The cutoff excludes rows created afterward where a creation timestamp exists.
Settings without a creation timestamp and all updates are read live. Different
parts and retries can observe intervening ingestion updates, retention or
deletions. Late arrivals with earlier application timestamps do not become a
historical snapshot. Use the reported coverage/observation times and retain the
manifest rather than combining files into a claim of transactional consistency.

## Cleanup and operations

Only bounded request metadata and cursors persist: at most twenty rows per user.
Admission serializes on the user; preparing another request removes that user's
expired metadata. Session/account deletion cascades remove their bounded request
metadata. Other expired/cancelled/completed metadata can remain until the next
preparation or session/account deletion, but cannot authorize expired delivery.
No sensitive artifact store, blob bucket or scheduled artifact cleanup exists.

Downloaded files are controlled by the recipient and survive source deletion,
retention, cancellation and access revocation. Store and delete them deliberately;
the export does not send them to support, an AI tool or another recipient.

Migration and deployment follow [the normal rollout](./migrations.md). This guide
does not authorize a real-data export, hosted migration, deployment or publication.
