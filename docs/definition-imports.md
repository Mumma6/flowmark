# Preview code-owned process metadata

The existing booking example emits `bookingRef` and a `submitted` count. The
optional [booking definition](../examples/booking-definition.json) describes
that reference as an exact lookup and gives the count a business label. It
reuses existing result/search declarations; it adds no execution behavior.

Open **Settings → Process metadata**, paste a definition and choose **Preview
changes**. Review the proposed labels and search fields, then choose **Apply
reviewed metadata**. A workflow's **Configuration** section offers the same flow.
The [accepted contract](decisions/0012-explicit-definition-imports.md) preserves
existing ownership, immutable revisions and historical run selection.

## Explicit request

Send `POST /api/trpc/resultDeclarations.previewImport` with a Studio session
cookie and JSON body:

```json
{
  "projectId": "<your project UUID>",
  "definition": {
    "version": 1,
    "source": "booking-app",
    "workflow": "booking.create",
    "result": {
      "revision": "booking-v1",
      "fields": [
        {
          "path": ["submitted"],
          "label": "Submitted bookings",
          "kind": "count",
          "aggregate": true
        }
      ]
    },
    "searchFields": [{ "key": "bookingRef", "role": "lookup" }]
  }
}
```

The session must belong to the explicit project. Ingestion keys, read keys and
delegated agent tokens cannot use this management boundary. Neither the
definition's `source` nor the returned hashes grant authority. No credentials
belong in the definition document.

After reviewing the response, send `POST /api/trpc/resultDeclarations.applyImport`
with the same session and a body containing `projectId` and `command`:

```json
{
  "projectId": "<your project UUID>",
  "command": {
    "definition": "<the same definition object, not a string>",
    "manifestFingerprint": "<manifestFingerprint from preview>",
    "baseFingerprint": "<baseFingerprint from preview>"
  }
}
```

`definition` must be the original JSON object; the string above only marks its
position. Do not submit the entire preview response as a command. The API
strictly decodes the document again and rechecks owner membership inside the
transaction. All declaration writers share the same project/workflow lock,
including creation when no configuration exists yet. Apply compares the reviewed
document and base to fresh stored metadata; a stale or conflicting review is an
error and requires another preview. The complete write, provenance and receipt
commit together or roll back together.

The response contains `status` (`Applied`, `Unchanged` or `AlreadyApplied`),
`receiptId`, `appliedAt`, `source`, `workflow`, the newly created `resultRevision`
(or `null`) and `addedSearchKeys`. Retrying the **same command** after a lost
reply returns its original receipt without another write. `AlreadyApplied`
describes that historical command, not a promise that nobody has changed other
metadata since; preview again to inspect the current configuration.

The normal tRPC `result.data` contains:

- `status`: `Reviewable`, `Unchanged` or `Conflict`.
- `result`: `action` (`NotRequested`, `Create`, `Unchanged`, `Conflict`), the
  `current` declaration and `requested` declaration (or `null`).
- `searchFields`: whether the section was `requested`, `additions`, conflicting
  requested fields in `conflicts`, all existing fields in `retained`,
  `capacityExceeded` and the complete `proposed` configuration. `proposed` is
  `null` if any part of the import conflicts; partial changes are not a plan.
- Project/source/workflow/version plus `manifestFingerprint` and
  `baseFingerprint` for identifying the reviewed request and observed base.

With an empty configuration, the example returns `Reviewable`, result `Create`
and one added lookup. If Studio already declared the same revision/fields,
those are unchanged and retain their existing ownership. If the label changes
under `booking-v1`, the result is `Conflict`: choose a new revision. Existing
search keys absent from the file are retained, including when `searchFields`
is `[]`; changing an existing role or dimension values also conflicts.

Applying new metadata records its code source. Existing identical Studio
metadata remains Studio-owned. Studio can edit its own search keys and create
new manual revisions. It cannot change or remove a code-owned search key:
replacement requests must preserve those entries unchanged, otherwise the
whole request is rejected. Ownership transfer and deletion are not offered by
this import flow.

## Discover the applied meaning

Studio shows paginated **Declared meaning** alongside import/configuration:
the actual result labels, revision and Studio/code source, plus the enabled
reference/category fields and their sources. The existing journey mapper uses
these same declared reference fields; importing a lookup does not invent links
between runs or merge matching business references automatically.

Authorized readers use the existing `workflow.meaning` query, or MCP
`list_workflows` with `workflow` and optional `revision`. Each returned revision
includes `source` (`null` for Studio); `searchSources` maps code-owned field keys
to their source. Existing pagination, project isolation, truncation notices and
read-only permissions remain. No extra tool or credential is needed.

## Scope and bounds

One document targets one workflow for result labels and search fields. `version` must be `1`; `source` is a
lowercase code of 1–64 characters (`[a-z][a-z0-9_-]*`); workflow is nonblank and
at most 200 characters. Include at least one of `result`, `searchFields` or `process`.
Unknown properties, including nested ones, are rejected. Existing declaration
limits apply: 12 result fields, path depth 5, eight unique search keys and 20
dimension values. The union with existing search keys must also fit eight.

`@flowmarkdev/core` exports `DefinitionImportSchema`, `DefinitionImport`,
`previewDefinitionImport`, `DefinitionImportSnapshot` and
`DefinitionImportPreview`. The API use case is
`ManageResultDeclarations.previewImport(userId, projectId, unknown)`; it
authorizes before strict decoding and reads only the requested result revision
and the selected workflow's bounded search fields. No SDK method was added.

## History and instrumentation

Result labels use the run's explicitly reported `properties.definitionRevision`.
For future runs that should use this result declaration, application code must
explicitly report `definitionRevision: "booking-v1"` with its existing workflow
properties. The original booking example remains unchanged. Import preview
never assigns a revision to past runs, reinterprets their business result or
uploads definitions from `workflow()`/`defineWorkflow()`. TypeScript generics
remain compile-time only. Application-owned results remain reported evidence,
not verified correctness.

[`code-owned-booking.ts`](../examples/code-owned-booking.ts) shows the explicit
revision/reference properties using the ordinary SDK. It reads the local JSON
constant but sends only telemetry; it does not call the import API. To change
labels, create/import `booking-v2` and deliberately start future runs with that
revision. Existing `booking-v1` runs keep their original meaning.

The preview is an advisory read, not a transaction or reservation. Apply owns
the fresh authorization, locking, stale check and atomic write. Application
execution remains entirely outside Flowmark.

## Review a composed process definition

An optional `process` section groups exact observed workflow names into roles.
It uses the same owner-only preview, apply and receipt. A process-only import
can omit `result` and `searchFields`. The top-level `workflow` identifies the
metadata editor's workflow. The stable `process.key` identifies the composition
within the project, including when an observed workflow name changes.

```json
{
  "version": 1,
  "source": "booking-app",
  "workflow": "reservation.request",
  "process": {
    "key": "reservation",
    "revision": 2,
    "members": [
      { "role": "request", "workflows": ["reservation.request"] },
      {
        "role": "confirmation",
        "workflows": ["reservation.confirm", "reservation.verify"]
      },
      { "role": "delivery", "workflows": ["reservation.deliver"] }
    ]
  }
}
```

Begin with revision 1 and advance by one. The source that created the process
owns its subsequent imports. The project owner reviews and applies them. A
process has up to eight distinct roles, with up to four exact workflow names
per role. Use each workflow name at most once in a definition.

Each role preview shows which candidate names have been observed in the
project. Zero matches are **Excluded**, one is **Matched**, and multiple are
**Ambiguous**. Studio links observed names to their recorded runs. A match
describes membership in this reviewed interpretation. Review the linked runs
for actual execution and business outcomes.

The receipt preserves the accepted definition and the matches observed at
review. When proposing a rename, submit the next revision with the new
workflow name. The review shows the current accepted interpretation beside the
proposal. Preview an older revision to inspect its saved matches. The run's
recorded workflow name and its reported result revision continue to govern
historical run reads. Old SDKs can continue to emit ordinary workflow markers
before and after an import.

## Review a process candidate in Studio

From **Workflows**, choose **Review a process candidate**. Start with a question,
an observed workflow or a local coding-agent suggestion. Studio offers names
from the first discovery page and can check one recent recorded run for the exact
workflow you select. An empty or unavailable read leaves that evidence open.

Add the proposed name, source locator and revision together to review a local
shortlist alongside the recorded run. The review distinguishes source-only and
recorded-only support, agreement on the name, and differing names. An agreement on
a name still leaves process membership and business meaning for review. A source
comment or locator is reviewer-supplied context.

Edit or rename the candidate, accept it locally, or dismiss and restore it. The
review lives in the current tab. The selected exact workflow reaches the
authorized project read. The candidate question, source details and unknowns
stay in the browser. Use the separate definition import to review and save
authorized process metadata.
