# Shared live investigations

Open **Investigations** to see your private questions and questions shared with
the selected project. Prepare a shared copy from one of your private entries, or
use **Share live question** in the business evidence workspace. Review the title,
evidence depth and audience, then explicitly confirm sharing.

Sharing creates an immutable copy of the question, not its results. The private
original stays private. Deleting that original does not delete the shared copy.
An authenticated link contains only its project and object IDs; it grants no
access. Recipients must sign in and already have access to that project. If their
current project differs, Studio asks them to select the link's project first.

## Evidence depth

- **Diagnostic** copies preserve supported run sections, technical periods and
  linked comparisons. Only current owners and diagnostic viewers can see their
  title and selection. Business readers cannot publish or open these copies.
- **Business** copies use the published business evidence query contract. All
  recipients, including owners, use that restricted view. Current publication
  must still permit result paths, reference namespaces and filters before the
  question's title or selection is returned. Technical filters are rejected.

A first-page run Events question can be copied at business depth. Other private
questions require diagnostic depth until an explicit business representation is
supported. Saved continuation cursors cannot be shared; return to the first page
and save that question. Sharing never silently removes a filter or cursor.

Questions recompute when opened. Absolute comparison windows stay absolute;
relative peer-day questions remain live. Missing source evidence is an unavailable
or empty observation, not a newly stored result or proof of activity. Completed
does not mean every record succeeded.

## Revocation and limits

The creator may revoke their shared copy; the project owner may revoke any copy.
Other recipients cannot edit or revoke it. Revocation removes only that copy and
makes its link unavailable. The source telemetry and private original remain.

Every request rechecks current project/account and creator membership. Delegated
reads also require a live grant for the same project. Object management requires
a native Studio session; ingestion/read keys do not manage or read saved objects.
Removing/leaving a project deletes that creator's shared copies. Rejoining does
not revive their old IDs or old delegated grants. Removing a recipient blocks
subsequent shared reads. Source data remains governed by its separate permissions.

A publication change can make a business question unavailable. Ordinary recipients
cannot see its old title or filters. Its creator and the project owner receive a
minimal cleanup entry so they can revoke it. A later publication may make the live
question valid again; this is a current query, not an old captured observation.
Previously delivered copies cannot be recalled.

Titles are deliberately shared text (120 characters maximum). Selection JSON is
at most 16 KiB. A creator may keep at most 25 shared questions per project, with
100 across the project. Lists return at most 25 permitted/authorized cleanup
entries, with no hidden-object counts. A changed or removed paging anchor may
require restarting the list.

## Lifecycle and rollout

Migration 0029 adds immutable shared questions and a creator-membership foreign
key, so membership removal deletes the corresponding copies atomically. Existing
account/project cleanup drains shared and private questions in bounded batches
within the existing persisted phase; phase numbers do not change. Migration 0030
adds the creator/project lookup index used by account cleanup and membership
cascades. Account cleanup
may delete only its creator's shared copies even when another project is fenced.
Other users' copies and other projects remain protected.

Follow [database rollout](migrations.md): disposable local/CI checks, approved
Preview verification, then migration before Staging deployment. Deploy matching
application and cleanup code together; use a reviewed forward fix if a rollback
would omit the new bounded cleanup behavior. This change adds no retention job,
captured result storage, public sharing, dependency or hosted configuration.

Captured run evidence is a separate implementation under [ADR 0019](decisions/0019-shared-investigations-and-captured-evidence.md).
Its expiry, physical cleanup and erasure gates remain required before admission.
