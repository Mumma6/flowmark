import { sql } from "drizzle-orm"
import type { WorkflowAttempt, WorkflowRetryReference } from "@flowmarkdev/core"
import {
  type AnyPgColumn,
  boolean,
  index,
  bigint,
  bigserial,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { user } from "./auth.js"
import type {
  WorkflowError,
  WorkflowFailure,
  WorkflowProperties,
  WorkflowResult,
  ResultDeclaration,
  SearchFields,
} from "@flowmarkdev/core"

export { account, session, user, verification } from "./auth.js"

export type StoredWorkflowError = WorkflowError | WorkflowFailure

export const workflowEventType = pgEnum("workflow_event_type", [
  "expectation_declared",
  "expectation_resolved",
  "expectation_cancelled",
  "started",
  "step",
  "properties",
  "error",
  "operation_started",
  "operation_completed",
  "operation_failed",
  "progress",
  "report",
  "completed",
  "failed",
])

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("projects_workspace_id_idx").on(table.workspaceId)],
)

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("workflows_project_id_idx").on(table.projectId),
    uniqueIndex("workflows_project_name_uidx").on(table.projectId, table.name),
  ],
)

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id),
    externalId: text("external_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    properties: jsonb("properties").$type<WorkflowProperties>(),
    error: jsonb("error").$type<StoredWorkflowError>(),
    result: jsonb("result").$type<WorkflowResult>(),
    outcome: text("outcome"),
    environment: text("environment"),
    release: text("release"),
    correlationId: text("correlation_id"),
    parentRunId: text("parent_run_id"),
    retryOf: jsonb("retry_of").$type<WorkflowRetryReference>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("workflow_runs_properties_gin_idx").using(
      "gin",
      table.properties.op("jsonb_path_ops"),
    ),
    index("workflow_runs_workflow_started_idx").on(
      table.workflowId,
      table.startedAt,
    ),
    index("workflow_runs_correlation_workflow_idx").on(
      table.correlationId,
      table.workflowId,
      table.startedAt,
    ),
    index("workflow_runs_parent_workflow_idx").on(
      table.parentRunId,
      table.workflowId,
      table.startedAt,
    ),
    uniqueIndex("workflow_runs_external_id_uidx").on(
      table.workflowId,
      table.externalId,
    ),
    index("workflow_runs_external_lookup_idx").on(
      table.externalId,
      table.workflowId,
    ),
  ],
)

export const workflowEvents = pgTable(
  "workflow_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull().unique(),
    receiptOrder: bigserial("receipt_order", { mode: "number" }).notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.id),
    type: workflowEventType("type").notNull(),
    step: text("step"),
    operationId: uuid("operation_id"),
    expectationEffective: boolean("expectation_effective")
      .notNull()
      .default(false),
    expectationOwnerId: uuid("expectation_owner_id").references(
      (): AnyPgColumn => workflowExpectations.id,
      { onDelete: "cascade" },
    ),
    expectation:
      jsonb("expectation").$type<
        import("@flowmarkdev/core").ExpectationEvent
      >(),
    expectationObservedAt: timestamp("expectation_observed_at", {
      withTimezone: true,
    }),
    operationName: text("operation_name"),
    attempt: jsonb("attempt").$type<WorkflowAttempt>(),
    durationMs: doublePrecision("duration_ms"),
    progressCompleted: bigint("progress_completed", { mode: "number" }),
    progressTotal: bigint("progress_total", { mode: "number" }),
    progressUnit: text("progress_unit"),
    reason: text("reason"),
    properties: jsonb("properties").$type<WorkflowProperties>(),
    error: jsonb("error").$type<StoredWorkflowError>(),
    result: jsonb("result").$type<WorkflowResult>(),
    outcome: text("outcome"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("workflow_events_run_timeline_idx").on(table.runId, table.occurredAt),
  ],
)

/** Same-lifetime projections; raw run/event ownership remains authoritative. */
export const workflowRunFacts = pgTable("workflow_run_facts", {
  runId: uuid("run_id")
    .primaryKey()
    .references(() => workflowRuns.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  sourceReceipt: bigint("source_receipt", { mode: "number" }).notNull(),
  selection: jsonb("selection").notNull(),
  status: text("status").notNull(),
  durationMs: doublePrecision("duration_ms"),
  step: text("step"),
  result: jsonb("result").$type<WorkflowResult>(),
  definitionRevision: text("definition_revision"),
  failCode: text("fail_code"),
})

/** Terminal metric samples and operation occurrences, never error/context payloads. */
export const workflowMetricFacts = pgTable(
  "workflow_metric_facts",
  {
    eventId: uuid("event_id")
      .primaryKey()
      .references(() => workflowEvents.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    type: workflowEventType("type").notNull(),
    operationId: uuid("operation_id"),
    operationName: text("operation_name"),
    durationMs: doublePrecision("duration_ms"),
    failCode: text("fail_code"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("workflow_metric_facts_run_idx").on(table.runId, table.occurredAt),
  ],
)

export const projectApiKeys = pgTable("project_api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  keyHash: text("key_hash").notNull().unique(),
  permission: text("permission", { enum: ["write", "read"] }).notNull(),
  name: text("name").notNull().default("API key"),
  keyPrefix: text("key_prefix").notNull().default("fm_••••"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const projectBrowserKeys = pgTable("project_browser_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  keyHash: text("key_hash").notNull().unique(),
  name: text("name").notNull().default("Browser key"),
  keyPrefix: text("key_prefix").notNull().default("fm_••••"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  allowedOrigins: jsonb("allowed_origins").$type<string[]>().notNull(),
  rateWindowStartedAt: timestamp("rate_window_started_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  rateWindowCount: integer("rate_window_count").default(0).notNull(),
})

export const projectMembers = pgTable(
  "project_members",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_members_user_project_uidx").on(
      table.userId,
      table.projectId,
    ),
    index("project_members_user_id_idx").on(table.userId),
  ],
)

/** Immutable workflow-owned presentation revisions; no runtime execution config. */
export const workflowResultDeclarations = pgTable(
  "workflow_result_declarations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    workflow: text("workflow").notNull(),
    revision: text("revision").notNull(),
    declaration: jsonb("declaration").$type<ResultDeclaration>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("workflow_result_declarations_revision_uidx").on(
      table.projectId,
      table.workflow,
      table.revision,
    ),
  ],
)

/** Mutable search permissions alongside immutable result presentation revisions. */
export const workflowSearchFields = pgTable(
  "workflow_search_fields",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    workflow: text("workflow").notNull(),
    fields: jsonb("fields").$type<SearchFields>().notNull(),
  },
  (table) => [
    uniqueIndex("workflow_search_fields_scope_uidx").on(
      table.projectId,
      table.workflow,
    ),
  ],
)

/** Bounded canonical facts. Cascades prevent projection-only archives after retention. */
export const workflowExpectations = pgTable(
  "workflow_expectations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    expectationId: text("expectation_id").notNull(),
    declarationEventId: uuid("declaration_event_id").references(
      () => workflowEvents.id,
      { onDelete: "cascade" },
    ),
    settlementEventId: uuid("settlement_event_id").references(
      () => workflowEvents.id,
      { onDelete: "cascade" },
    ),
    declaredAt: timestamp("declared_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    settlementType: text("settlement_type", {
      enum: ["expectation_resolved", "expectation_cancelled"],
    }),
  },
  (table) => [
    uniqueIndex("workflow_expectations_run_identity_uidx").on(
      table.runId,
      table.expectationId,
    ),
    index("workflow_expectations_deadline_idx")
      .on(table.deadlineAt, table.runId)
      .where(sql`${table.settlementEventId} is null`),
  ],
)
