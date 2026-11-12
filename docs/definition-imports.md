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

One document describes one workflow. `version` must be `1`; `source` is a
lowercase code of 1–64 characters (`[a-z][a-z0-9_-]*`); workflow is nonblank and
at most 200 characters. At least `result` or `searchFields` must be present.
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
