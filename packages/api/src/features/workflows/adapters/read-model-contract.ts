import type {
  DailyInsight as StoreDailyInsight,
  FailureCodeAttribution as StoreFailureCodeAttribution,
  FailureCodeInsight as StoreFailureCodeInsight,
  InsightWindow as StoreInsightWindow,
  IntelligenceQuery as StoreIntelligenceQuery,
  ListRunsQuery as StoreListRunsQuery,
  ListedRun as StoreListedRun,
  ListedRunsPage as StoreListedRunsPage,
  ProjectSearch as StoreProjectSearch,
  ProjectSearchReference as StoreProjectSearchReference,
  ProjectSearchRun as StoreProjectSearchRun,
  ProjectSearchWorkflow as StoreProjectSearchWorkflow,
  OperationAttribution as StoreOperationAttribution,
  OperationCompareRow as StoreOperationCompareRow,
  OperationInsight as StoreOperationInsight,
  ProjectSnapshot as StoreProjectSnapshot,
  RelatedRun as StoreRelatedRun,
  RelatedRuns as StoreRelatedRuns,
  RunComparison as StoreRunComparison,
  RunStatus as StoreRunStatus,
  RunTimelineEvent as StoreRunTimelineEvent,
  StoredRun as StoreStoredRun,
  WorkflowIntelligence as StoreWorkflowIntelligence,
  WorkflowSummary as StoreWorkflowSummary,
} from "@flowmark/db/persistence"
import type {
  DailyInsight,
  FailureCodeAttribution,
  FailureCodeInsight,
  InsightWindow,
  IntelligenceQuery,
  ListRunsQuery,
  ListedRun,
  ListedRunsPage,
  ProjectSearch,
  ProjectSearchReference,
  ProjectSearchRun,
  ProjectSearchWorkflow,
  OperationAttribution,
  OperationCompareRow,
  OperationInsight,
  ProjectSnapshot,
  RelatedRun,
  RelatedRuns,
  RunComparison,
  RunStatus,
  RunTimelineEvent,
  StoredRun,
  WorkflowIntelligence,
  WorkflowSummary,
} from "../types.js"

type DeepWritable<T> =
  T extends ReadonlyArray<infer Item>
    ? Array<DeepWritable<Item>>
    : T extends object
      ? { -readonly [Key in keyof T]: DeepWritable<T[Key]> }
      : T

type SameKeys<A, B> =
  Exclude<keyof A, keyof B> extends never
    ? Exclude<keyof B, keyof A> extends never
      ? true
      : false
    : false

type SameShape<A, B> =
  SameKeys<DeepWritable<A>, DeepWritable<B>> extends true
    ? [DeepWritable<A>] extends [DeepWritable<B>]
      ? [DeepWritable<B>] extends [DeepWritable<A>]
        ? true
        : false
      : false
    : false

type AssertEqual<
  A,
  B extends (SameShape<A, B> extends true ? unknown : never),
> = true

export type WorkflowReadModelContract = [
  AssertEqual<RunStatus, StoreRunStatus>,
  AssertEqual<StoredRun, StoreStoredRun>,
  AssertEqual<WorkflowSummary, StoreWorkflowSummary>,
  AssertEqual<DailyInsight, StoreDailyInsight>,
  AssertEqual<OperationInsight, StoreOperationInsight>,
  AssertEqual<FailureCodeInsight, StoreFailureCodeInsight>,
  AssertEqual<ProjectSnapshot, StoreProjectSnapshot>,
  AssertEqual<OperationCompareRow, StoreOperationCompareRow>,
  AssertEqual<RunComparison, StoreRunComparison>,
  AssertEqual<InsightWindow, StoreInsightWindow>,
  AssertEqual<OperationAttribution, StoreOperationAttribution>,
  AssertEqual<FailureCodeAttribution, StoreFailureCodeAttribution>,
  AssertEqual<WorkflowIntelligence, StoreWorkflowIntelligence>,
  AssertEqual<IntelligenceQuery, StoreIntelligenceQuery>,
  AssertEqual<RunTimelineEvent, StoreRunTimelineEvent>,
  AssertEqual<RelatedRun, StoreRelatedRun>,
  AssertEqual<RelatedRuns, StoreRelatedRuns>,
  AssertEqual<ListedRun, StoreListedRun>,
  AssertEqual<ListRunsQuery, StoreListRunsQuery>,
  AssertEqual<ListedRunsPage, StoreListedRunsPage>,
  AssertEqual<ProjectSearchWorkflow, StoreProjectSearchWorkflow>,
  AssertEqual<ProjectSearchRun, StoreProjectSearchRun>,
  AssertEqual<ProjectSearchReference, StoreProjectSearchReference>,
  AssertEqual<ProjectSearch, StoreProjectSearch>,
]
