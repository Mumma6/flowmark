# ADR 0014: Save private live investigation selections

- Status: accepted by maintainer on 2026-11-12
- Date: 2026-11-12
- Tasks: Product TASK-005.1–005.2

The maintainer explicitly approved “Approve private live selections.”
Implementation and local verification are authorized; hosted operations and merge
remain separate.

## Contract

A signed-in project member may save a named, versioned question for themselves.
Supported questions reuse the existing run, technical-period and linked-comparison
selection schemas. Store only the validated selection, title, immutable owner and
project IDs, creation timestamp and internal object ID. Never store arbitrary
URLs, credentials, result bodies or captured telemetry. Bound titles to 120
characters, selections to 16 KiB and each owner's project list to 100 objects.
List pages contain at most 25 records, ordered by creation timestamp and ID with
an owner/project-bound cursor.

Every save/list/read/delete reauthorizes current project membership and scopes the
object to both the current session user and project. Project readers, ingestion
keys and delegated agent sessions cannot manage private objects. Sharing a saved
object ID or selection URL grants no rights. Membership removal denies subsequent
object operations; rejoining restores access to the same private selections.
Deleting a user or project cascades to its selections.

Saving never validates or preserves the current existence of source telemetry.
Reopening first reads the private object under fresh authorization, then opens the
existing supported selection URL, whose source reads authorize independently.
Missing/expired source evidence uses the existing explicit missing/empty view;
it never becomes a stored snapshot. Unsupported stored selection versions display
an unavailable selection state with deletion still possible. Invalid new versions
and mismatched project IDs are rejected before storage.

Delete removes only the chosen private selection immediately. It does not delete
telemetry, affect colleagues or alter retention. There is no rename/update, team
sharing, public link, snapshot, expiry extension, hosted operation or new dependency
in this increment. Studio labels these views as live and recomputes on reopen.

## Verification

Use managed disposable PostgreSQL for CRUD, owner/project/session isolation,
revocation, strict versions, pagination, caps and additive schema-upgrade coverage.
Exercise actual Studio save, reload, reopen and delete controls locally. Hosted
Preview migration and deployment remain separate gates.
