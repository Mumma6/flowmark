import {
  index,
  bigint,
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
} from "@flowmarkdev/core"

export { account, session, user, verification } from "./auth.js"

export type StoredWorkflowError = WorkflowError | WorkflowFailure

export const workflowEventType = pgEnum("workflow_event_type", [
  "started",
  "step",
  "properties",
  "error",
  "operation_started",
  "operation_completed",
  "operation_failed",
  "progress",
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
    environment: text("environment"),
    release: text("release"),
    correlationId: text("correlation_id"),
    parentRunId: text("parent_run_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
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
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.id),
    type: workflowEventType("type").notNull(),
    step: text("step"),
    operationId: uuid("operation_id"),
    operationName: text("operation_name"),
    durationMs: doublePrecision("duration_ms"),
    progressCompleted: bigint("progress_completed", { mode: "number" }),
    progressTotal: bigint("progress_total", { mode: "number" }),
    progressUnit: text("progress_unit"),
    reason: text("reason"),
    properties: jsonb("properties").$type<WorkflowProperties>(),
    error: jsonb("error").$type<StoredWorkflowError>(),
    result: jsonb("result").$type<WorkflowResult>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("workflow_events_run_timeline_idx").on(table.runId, table.occurredAt),
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
