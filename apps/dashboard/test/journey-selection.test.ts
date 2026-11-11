import { describe, expect, it } from "vitest"
import { Result } from "effect"
import type { ReferenceJourneyPage } from "@flowmarkdev/core"
import {
  journeyHref,
  journeyPageInput,
  journeyQueryKey,
  nextJourneyPage,
  readJourneySelection,
  startJourneyHref,
} from "../features/journeys/journey-selection"
import {
  investigationReturn,
  runInvestigationPath,
} from "../features/runs/investigation/investigation-navigation"

const projectId = "11111111-1111-4111-8111-111111111111"
const anchorRunId = "22222222-2222-4222-8222-222222222222"
const reference = {
  workflow: "patient.match",
  key: "referralRef",
  value: "SYN-REF-1",
}
const href = startJourneyHref(
  projectId,
  reference,
  "/?workflow=patient.match&status=Failed&search=keep-me",
)
const selection = Result.getOrThrow(
  readJourneySelection(
    new URL(href, "http://localhost").searchParams.get(journeyQueryKey)!,
    projectId,
  ),
)

describe("Studio journey selection and continuation", () => {
  it("starts with only the explicit anchor namespace and retains the Explore selection", () => {
    expect(selection.stage).toBe("configure")
    expect(selection.query.namespaces).toEqual([
      { workflow: "patient.match", key: "referralRef" },
    ])
    const params = new URL(href, "http://localhost").searchParams
    expect(params.get("status")).toBe("Failed")
    expect(params.get("search")).toBe("keep-me")
  })

  it("projects rich search results into the strict reference input", () => {
    const searchResult = {
      ...reference,
      runId: anchorRunId,
      externalId: "application-run",
    }
    const target = new URL(
      startJourneyHref(projectId, searchResult),
      "http://localhost",
    )
    const selected = Result.getOrThrow(
      readJourneySelection(
        target.searchParams.get(journeyQueryKey)!,
        projectId,
      ),
    )
    expect(selected.query).toEqual({
      ...reference,
      namespaces: [{ workflow: reference.workflow, key: reference.key }],
      limit: 25,
    })
  })

  it("rejects another project, malformed mappings and unsupported filters without widening", () => {
    expect(
      Result.isFailure(
        readJourneySelection(JSON.stringify(selection), anchorRunId),
      ),
    ).toBe(true)
    expect(Result.isFailure(readJourneySelection("not-json", projectId))).toBe(
      true,
    )
    expect(
      Result.isFailure(
        readJourneySelection(
          JSON.stringify({
            ...selection,
            query: { ...selection.query, namespaces: [] },
          }),
          projectId,
        ),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        readJourneySelection(
          JSON.stringify({
            ...selection,
            query: { ...selection.query, environment: "prod" },
          }),
          projectId,
        ),
      ),
    ).toBe(true)
  })

  it("preserves the exact journey through inspector sections and full-page return", () => {
    const source = journeyHref(href, {
      ...selection,
      stage: "evidence",
      query: {
        ...selection.query,
        namespaces: [
          ...selection.query.namespaces,
          { workflow: "appointment.book", key: "caseRef" },
        ],
      },
    })
    const target = new URL(
      runInvestigationPath(anchorRunId, source, "confirmations"),
      "http://localhost",
    )
    expect(target.searchParams.get(journeyQueryKey)).toBe(
      new URL(source, "http://localhost").searchParams.get(journeyQueryKey),
    )
    expect(target.searchParams.get("view")).toBe("confirmations")
    expect(target.searchParams.get("status")).toBe("Failed")
    expect(investigationReturn(target.searchParams.get("from")).href).toBe(
      source,
    )
  })

  it("keeps candidate paging distinct from selected-run paging and pins the chosen anchor", () => {
    const candidatePage = {
      state: "Ambiguous",
      nextCandidateCursor: "candidate-page",
      nextCursor: null,
    } as ReferenceJourneyPage
    const nextCandidate = nextJourneyPage(candidatePage)!
    expect(
      journeyPageInput(
        { ...selection.query, anchorRunId, cursor: "old-node" },
        nextCandidate,
      ),
    ).toMatchObject({
      anchorRunId: undefined,
      cursor: undefined,
      candidateCursor: "candidate-page",
      limit: 25,
    })
    const nodePage = {
      state: "Selected",
      anchorRunId,
      nextCursor: "node-page",
      nextCandidateCursor: null,
    } as ReferenceJourneyPage
    const nextNode = nextJourneyPage(nodePage)!
    expect(
      journeyPageInput(
        { ...selection.query, candidateCursor: "old-choice" },
        nextNode,
      ),
    ).toMatchObject({
      anchorRunId,
      cursor: "node-page",
      candidateCursor: undefined,
      limit: 25,
    })
    expect(nextJourneyPage({ ...nodePage, nextCursor: null })).toBeUndefined()
    expect(
      nextJourneyPage({ ...candidatePage, nextCandidateCursor: null }),
    ).toBeUndefined()
  })
})
