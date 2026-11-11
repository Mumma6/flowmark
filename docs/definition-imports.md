# Preview code-owned process metadata

The existing booking example emits `bookingRef` and a `submitted` count. The
optional [booking definition](../examples/booking-definition.json) describes
that reference as an exact lookup and gives the count a business label. It
reuses existing result/search declarations; it adds no execution behavior.

This increment provides **preview only**. It does not save definitions, claim
ownership, enable a lookup or change displayed results. Saving a reviewed import
and exposing it in Studio are separate increments. The ownership and future
apply contract is proposed in [ADR 0012](decisions/0012-explicit-definition-imports.md).

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

The preview is an advisory read, not a transaction or reservation. A future
apply operation must reauthorize, lock/reread its base, compare fingerprints and
write provenance and changes atomically. A stale preview must be rejected.
