import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  encodeRevisionDiscoveryCursor,
  encodeWorkflowDiscoveryCursor,
  RevisionCursor,
  scopeRevisionDiscoveryCursor,
  scopeWorkflowDiscoveryCursor,
  WorkflowCursor,
} from "../src/persistence/workflows/workflow-discovery-cursor.js"

const project = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"
const revisionId = "33333333-3333-4333-8333-333333333333"

describe("workflow discovery cursors", () => {
  it("round-trips a workflow page inside the authorized project", () => {
    const encoded = encodeWorkflowDiscoveryCursor({
      projectId: project,
      name: "customer.import",
    })
    assert.deepEqual(
      scopeWorkflowDiscoveryCursor(encoded, project),
      WorkflowCursor.Continue({ name: "customer.import" }),
    )
  })

  it("rejects a workflow cursor from another project", () => {
    const encoded = encodeWorkflowDiscoveryCursor({
      projectId: other,
      name: "customer.import",
    })
    assert.deepEqual(
      scopeWorkflowDiscoveryCursor(encoded, project),
      WorkflowCursor.Invalid(),
    )
    assert.equal(
      WorkflowCursor.$is("Invalid")(
        scopeWorkflowDiscoveryCursor("not-a-cursor", project),
      ),
      true,
    )
  })

  it("rejects a revision cursor that changes workflow or project", () => {
    const encoded = encodeRevisionDiscoveryCursor({
      projectId: project,
      workflow: "alpha",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: revisionId,
    })
    assert.deepEqual(
      scopeRevisionDiscoveryCursor(encoded, {
        projectId: project,
        workflow: "alpha",
      }),
      RevisionCursor.Continue({
        createdAt: "2026-01-01T00:00:00.000Z",
        id: revisionId,
      }),
    )
    assert.equal(
      RevisionCursor.$is("Invalid")(
        scopeRevisionDiscoveryCursor(encoded, {
          projectId: project,
          workflow: "beta",
        }),
      ),
      true,
    )
    assert.equal(
      RevisionCursor.$is("Invalid")(
        scopeRevisionDiscoveryCursor(
          encodeRevisionDiscoveryCursor({
            projectId: other,
            workflow: "alpha",
            createdAt: "2026-01-01T00:00:00.000Z",
            id: revisionId,
          }),
          { projectId: project, workflow: "alpha" },
        ),
      ),
      true,
    )
  })
})
