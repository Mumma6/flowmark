import { sql } from "drizzle-orm"
export { dataLifecycleOperations } from "./data-lifecycle.js"
export { accountLifecycleOperations } from "./account-lifecycle.js"
import type { WorkflowAttempt, WorkflowRetryReference } from "@flowmarkdev/core"
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  bigint,
  bigserial,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { user } from "./auth.js"
import { oauthClient, oauthConsent } from "./oauth-provider.js"
import type {
  WorkflowError,
  WorkflowFailure,
  WorkflowProperties,
  WorkflowResult,
  ResultDeclaration,
  SearchFields,
} from "@flowmarkdev/core"

export { account, authRateLimits, session, user, verification } from "./auth.js"
export {
  jwks,
  oauthAccessToken,
  oauthClient,
  oauthClientAssertion,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
} from "./oauth-provider.js"

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

export const oauthConsentIntentState = pgEnum("oauth_consent_intent_state", [
  "pending",
  "completed",
  "superseded",
  "failed",
  "revoked",
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
    lifecycleOperationId: uuid("lifecycle_operation_id"),
    credentialEpoch: integer("credential_epoch").notNull().default(0),
    newRunAfter: timestamp("new_run_after", { withTimezone: true }),
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
  credentialEpoch: integer("credential_epoch").notNull().default(0),
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
  credentialEpoch: integer("credential_epoch").notNull().default(0),
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
    role: text("role", { enum: ["owner", "viewer", "business"] }).notNull(),
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
    uniqueIndex("project_members_one_owner_uidx")
      .on(table.projectId)
      .where(sql`${table.role} = 'owner'`),
    check(
      "project_members_role_check",
      sql`${table.role} IN ('owner', 'viewer', 'business')`,
    ),
  ],
)

/** Creation target only; workspace grouping never grants project authority. */
export const personalWorkspaces = pgTable("personal_workspaces", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id),
})

export const projectInvitations = pgTable(
  "project_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull(),
    tokenHash: text("token_hash"),
    state: text("state", {
      enum: ["pending", "accepted", "declined", "revoked"],
    })
      .notNull()
      .default("pending"),
    role: text("role", { enum: ["viewer", "business"] })
      .notNull()
      .default("viewer"),
    delivery: text("delivery", { enum: ["pending", "submitted", "failed"] })
      .notNull()
      .default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_invitation_pending_email_uidx")
      .on(table.projectId, table.email)
      .where(sql`${table.state} = 'pending'`),
    index("project_invitation_recipient_idx").on(table.recipientUserId),
    index("project_invitation_expiry_idx").on(table.expiresAt),
    check(
      "project_invitation_state_check",
      sql`${table.state} IN ('pending', 'accepted', 'declined', 'revoked')`,
    ),
    check(
      "project_invitation_role_check",
      sql`${table.role} IN ('viewer', 'business')`,
    ),
    check(
      "project_invitation_delivery_check",
      sql`${table.delivery} IN ('pending', 'submitted', 'failed')`,
    ),
  ],
)

/** Owner-controlled disclosure, independent of telemetry/meaning ownership. */
export const projectEvidencePublications = pgTable(
  "project_evidence_publications",
  {
    projectId: uuid("project_id")
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull().default(0),
    publication: jsonb("publication").$type<unknown>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "project_evidence_publication_revision_check",
      sql`${table.revision} >= 0`,
    ),
  ],
)

/** Owner-private live questions; no captured telemetry or access grants. */
export const savedInvestigations = pgTable(
  "saved_investigations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    selection: jsonb("selection").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("saved_investigations_owner_project_created_idx").on(
      table.ownerId,
      table.projectId,
      table.createdAt,
      table.id,
    ),
  ],
)

/** Immutable project-shared questions; never captured results or grants. */
export const sharedInvestigations = pgTable(
  "shared_investigations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    selection: jsonb("selection").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "shared_investigation_creator_membership_fk",
      columns: [table.creatorId, table.projectId],
      foreignColumns: [projectMembers.userId, projectMembers.projectId],
    }).onDelete("cascade"),
    index("shared_investigations_creator_project_idx").on(
      table.creatorId,
      table.projectId,
    ),
    index("shared_investigations_project_created_idx").on(
      table.projectId,
      table.createdAt,
      table.id,
    ),
    check(
      "shared_investigation_title_check",
      sql`length(${table.title}) BETWEEN 1 AND 120 AND length(btrim(${table.title})) > 0`,
    ),
    check(
      "shared_investigation_selection_size_check",
      sql`octet_length(${table.selection}::text) <= 16384`,
    ),
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
    source: text("source"),
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
    sources: jsonb("sources")
      .$type<Readonly<Record<string, string>>>()
      .notNull()
      .default({}),
  },
  (table) => [
    uniqueIndex("workflow_search_fields_scope_uidx").on(
      table.projectId,
      table.workflow,
    ),
  ],
)

/** Successful reviewed imports only; duplicate delivery never repeats a write. */
export const workflowDefinitionImports = pgTable(
  "workflow_definition_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workflow: text("workflow").notNull(),
    source: text("source").notNull(),
    manifestFingerprint: text("manifest_fingerprint").notNull(),
    baseFingerprint: text("base_fingerprint").notNull(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    resultRevision: text("result_revision"),
    addedSearchKeys: jsonb("added_search_keys")
      .$type<ReadonlyArray<string>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("workflow_definition_imports_review_uidx").on(
      table.projectId,
      table.workflow,
      table.source,
      table.manifestFingerprint,
      table.baseFingerprint,
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

/**
 * Immutable project allowlist for one OAuth authorization-code / grant family
 * (`oauth_refresh_token.authorization_code_id`). Insert/update/delete stays in
 * grant lifecycle tasks; reads intersect with current membership.
 */
export const agentAccessGrantProjects = pgTable(
  "agent_access_grant_projects",
  {
    authorizationCodeId: text("authorization_code_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.authorizationCodeId, table.projectId],
    }),
    index("agent_access_grant_projects_auth_code_idx").on(
      table.authorizationCodeId,
    ),
  ],
)

/**
 * Records session-submitted consent binding work; does not store tokens.
 * Links the Better Auth `oauth_consent` row to a chosen project allowlist.
 */
export const agentAccessOauthConsentIntents = pgTable(
  "agent_access_oauth_consent_intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    oauthConsentId: text("oauth_consent_id")
      .notNull()
      .references(() => oauthConsent.id, { onDelete: "cascade" }),
    authorizationCodeId: text("authorization_code_id").notNull(),
    resourceUrl: text("resource_url").notNull(),
    redirectUri: text("redirect_uri"),
    requestedScopes: jsonb("requested_scopes").$type<ReadonlyArray<string>>(),
    state: oauthConsentIntentState("state").notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_access_oauth_consent_intents_user_idx").on(table.userId),
    index("agent_access_oauth_consent_intents_client_idx").on(table.clientId),
    uniqueIndex("agent_access_oauth_consent_intents_consent_uidx").on(
      table.oauthConsentId,
    ),
  ],
)

/** Coarse last delegated read verification (no tokens). */
export const agentAccessConnectionLastAuth = pgTable(
  "agent_access_connection_last_auth",
  {
    authorizationCodeId: text("authorization_code_id").primaryKey().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    lastAuthenticatedAt: timestamp("last_authenticated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_access_connection_last_auth_user_idx").on(table.userId),
    index("agent_access_connection_last_auth_client_idx").on(table.clientId),
  ],
)
