# Private live investigations

Save a question to revisit its current evidence later. In Studio:

- A run's **Take the evidence** panel saves the current supported run selection,
  including its evidence section, cursor and page size when present in the URL.
- Explore offers saving when an accepted absolute technical-period selection is
  active. Arbitrary explorer filters are not silently converted into that format.
- Insights' **Linked process comparison** saves the exact analyzed question and
  selected evidence class/page. Form edits take effect only after analyzing.

Name the question, choose **Save investigation**, then open **Your investigations**
from workspace navigation. The list survives reload. **Open live investigation**
reads the private object under fresh authorization before opening the existing
selection URL. Each source read checks access independently. The saved question
is not a snapshot: later telemetry and retention can change its answer. A missing
run shows the existing “No run found in this project” state; empty periods and
unsupported comparisons keep their explicit availability messages.

## Ownership and deletion

Entries are private to the signed-in account and selected project, including when
another member has access to the same telemetry. Account and project transitions
scope cached state independently. API keys and delegated readers cannot manage
these entries. Knowing a saved ID or copying a selection link grants no access.
Every operation rechecks membership; removal denies subsequent reads and writes.
Rejoining restores access to the same private entries. User/project deletion
cascades to their entries.

**Delete saved investigation** asks for confirmation and immediately removes only
that saved question. It cannot be undone. It does not delete telemetry, affect
colleagues or extend retention. An unsupported stored selection can still be
deleted; save a supported new question instead. There are no public links,
colleague sharing, captured evidence or background refresh jobs in this increment.

Each account can keep 100 entries per project. Names are 1–120 characters;
selection JSON is at most 16 KiB. Lists use stable creation-time/internal-ID pages
of up to 25 entries. A deleted cursor anchor requires restarting the list. Failed
save/list/reopen/delete operations stay visible and preserve the user's current
selection. If a save reply is lost, refresh the list before retrying: saving again
creates a separate entry rather than overwriting an existing one.

## API boundary

The session-only tRPC `investigations` router exposes:

- `save` mutation: `{ projectId, command: { title, selection } }`.
- `list` query: `{ projectId, query: { cursor?, limit? } }`, returning bounded
  summaries and `nextCursor`; defaults to 25 entries.
- `get` query: `{ projectId, id }`, returning the owned entry or `null` when it
  is absent from that owner's project scope.
- `delete` mutation: `{ projectId, id }`, returning `{ deleted }`. An absent or
  foreign-owned entry returns `false` without disclosing its existence.

A valid session and current membership are required even for an absent entry.
Unsupported input versions, extra properties and mismatched selection/project
IDs are rejected. Stored unsupported versions return `supported: false`, with
`selection: null`; their unknown payload never reaches the client. Selection
schemas reuse `run`, `period` and `linked-comparison` version 1 contracts from
`@flowmarkdev/core`. Storage contains no arbitrary URL, credential or result body.

Migration `0023_private_live_investigations.sql` adds the private metadata table
and owner/project/time index. It does not modify telemetry or existing tables.
Review hosted Preview migration and app behavior before merging, then use the
ordered [database rollout](migrations.md). The accepted lifecycle contract is
[ADR 0014](decisions/0014-private-live-investigations.md).
