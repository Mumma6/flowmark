# ADR 0012: Explicit metadata preview and revision ownership

- Status: accepted by maintainer on 2026-11-12; read-only preview implemented
- Date: 2026-11-11
- Task: Product TASK-002.1
- Baseline: `84536d7` on `staging` (PR #175 merged)

## Concrete need

The existing booking setup emits a `bookingRef` and `result.submitted` but
does not configure their searchable/presentation meaning. A bounded JSON
document can preview the existing lookup and result declarations beside the
application's code. No new SDK runtime model, dependency, schema framework or
application execution responsibility is needed. See the
[worked request and exact response contract](../definition-imports.md).

## Accepted ownership and conflict contract

The maintainer approved this contract on 12 November 2026 with “Approve the
contract.” This accepts the semantics for the next implementation task; it does
not authorize hosted operations, merge or deployment.

1. Each newly created result revision has one immutable provenance: Studio or
   an explicit code `source`. A source is a provenance name, never a credential.
   New search keys likewise have one owner. Existing records remain legacy
   Studio-owned; matching imports never adopt them or transfer ownership.
2. No actor may replace an existing result revision. Identical content is a
   no-op; different content requires a new revision. Old runs keep their
   reported revision, including missing/unknown revisions. No backfill or
   implicit default to a latest revision is permitted.
3. Search imports are add-only. Identical keys retain their current ownership;
   changing a key's role or dimension values conflicts, even for the same code
   source. Omitted keys remain, and `[]` is not deletion. The combined limit is
   eight keys. A future ownership transfer/removal needs its own explicit
   reviewed operation; no transfer is offered by this contract.
4. Studio keeps its existing edits for Studio-owned search keys but may not
   mutate a code-owned key through the ordinary replacement endpoint. The
   write-enabled increment must enforce this on the server, preserve omitted
   code-owned keys and reject attempted changes/removals. Studio may create a
   fresh manual result revision; it cannot replace historical code revisions.
5. Explicit synchronization is a separate session-authorized management action,
   never part of starting/flushing a run. Read/ingestion credentials and
   delegated agent read grants gain no import or management rights. Every
   management operation verifies membership in the requested project.

## Read-only implementation

`DefinitionImportSchema` version 1 accepts one workflow, a source and optional
existing result/search declarations, at least one section present. Strict
decoding rejects unknown properties recursively. The pure bounded planner
reports new/identical/conflicting metadata, preserves omitted keys and shows
both current and requested result meaning. It never writes or assumes ownership
data that does not exist yet. The API's session-only POST preview does not call
any persistence mutation. SQL reads scope by project/workflow and only the
requested result revision (`LIMIT 1`), without loading revision history.

Canonical comparisons use explicit property order; absent `aggregate` equals
`false`. Result fields, paths and enum arrays retain order. An enum reorder is
conservatively a conflict. Existing metadata is preserved verbatim for no-ops.
SHA-256 fingerprints bind the project, source, workflow, version, requested
revision and canonical document/base values. They are review identities, not
signatures or apply capabilities. Search state is included in the base even
when not requested. Reads may observe concurrent changes; the preview makes no
transactional freshness guarantee.

## Required follow-up before enabling writes

Product TASK-002.2 must persist
provenance and audit receipts with the metadata, enforce the Studio guards
above, and reauthorize and reread under a transaction. Compare both manifest
and base fingerprints with the reviewed request, reject stale/conflicting
plans, and apply all changes atomically. Repeating an identical successful
import must be a no-op without ownership adoption. Locking/unique constraints
must also cover concurrent Studio edits/imports and creation of an absent row.
An error must not leave partial declarations or provenance behind.

This ADR does not assert that ownership storage or write guards already exist.
No migration, hosted operation or write-enabled import is part of TASK-002.1.
The ownership/synchronization contract is accepted; write-enabled implementation
remains separate. Merging the read-only implementation is not an implicit
approval of hosted operations.
