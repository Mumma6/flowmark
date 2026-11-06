import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { session, user } from "./auth.js"

/**
 * Better Auth `@better-auth/oauth-provider@1.7.17` and `jwt()` tables.
 * Property names match the provider models. SQL names follow the provider's
 * Drizzle generator (snake_case). Timestamps stay `timestamptz`, matching the
 * existing auth tables.
 */
const at = (name: string) => timestamp(name, { withTimezone: true })
const texts = (name: string) => text(name).array()

export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: at("created_at").notNull(),
  expiresAt: at("expires_at"),
  alg: text("alg"),
  crv: text("crv"),
})

export const oauthClient = pgTable(
  "oauth_client",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: boolean("disabled").default(false),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: texts("scopes"),
    clientCredentialsScopes: texts("client_credentials_scopes").default([]),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: at("created_at"),
    updatedAt: at("updated_at"),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: texts("contacts"),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: texts("redirect_uris").notNull(),
    postLogoutRedirectUris: texts("post_logout_redirect_uris"),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: boolean(
      "backchannel_logout_session_required",
    ),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: texts("grant_types"),
    responseTypes: texts("response_types"),
    requirePKCE: boolean("require_pkce"),
    dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
  },
  (table) => [index("oauth_client_user_id_idx").on(table.userId)],
)

export const oauthResource = pgTable("oauth_resource", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: texts("allowed_scopes"),
  customClaims: jsonb("custom_claims"),
  dpopBoundAccessTokensRequired: boolean(
    "dpop_bound_access_tokens_required",
  ).default(false),
  disabled: boolean("disabled").default(false),
  createdAt: at("created_at"),
  updatedAt: at("updated_at"),
  policyVersion: integer("policy_version").default(1),
  metadata: jsonb("metadata"),
})

export const oauthClientResource = pgTable(
  "oauth_client_resource",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: "cascade" }),
    metadata: jsonb("metadata"),
    createdAt: at("created_at"),
  },
  (table) => [
    index("oauth_client_resource_client_id_idx").on(table.clientId),
    index("oauth_client_resource_resource_id_idx").on(table.resourceId),
    uniqueIndex("oauth_client_resource_pair_uidx").on(
      table.clientId,
      table.resourceId,
    ),
  ],
)

export const oauthRefreshToken = pgTable(
  "oauth_refresh_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: texts("resources"),
    requestedUserInfoClaims: texts("requested_user_info_claims"),
    expiresAt: at("expires_at"),
    createdAt: at("created_at"),
    revoked: at("revoked"),
    rotatedAt: at("rotated_at"),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: at("rotation_replay_expires_at"),
    authTime: at("auth_time"),
    confirmation: jsonb("confirmation"),
    scopes: texts("scopes").notNull(),
  },
  (table) => [
    index("oauth_refresh_token_client_id_idx").on(table.clientId),
    index("oauth_refresh_token_session_id_idx").on(table.sessionId),
    index("oauth_refresh_token_user_id_idx").on(table.userId),
    index("oauth_refresh_token_authorization_code_id_idx").on(
      table.authorizationCodeId,
    ),
  ],
)

export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    token: text("token").unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: texts("resources"),
    requestedUserInfoClaims: texts("requested_user_info_claims"),
    refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
      onDelete: "cascade",
    }),
    expiresAt: at("expires_at"),
    createdAt: at("created_at"),
    revoked: at("revoked"),
    confirmation: jsonb("confirmation"),
    scopes: texts("scopes").notNull(),
  },
  (table) => [
    index("oauth_access_token_client_id_idx").on(table.clientId),
    index("oauth_access_token_session_id_idx").on(table.sessionId),
    index("oauth_access_token_user_id_idx").on(table.userId),
    index("oauth_access_token_authorization_code_id_idx").on(
      table.authorizationCodeId,
    ),
    index("oauth_access_token_refresh_id_idx").on(table.refreshId),
  ],
)

export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    resources: texts("resources"),
    requestedUserInfoClaims: texts("requested_user_info_claims"),
    scopes: texts("scopes").notNull(),
    createdAt: at("created_at"),
    updatedAt: at("updated_at"),
  },
  (table) => [
    index("oauth_consent_client_id_idx").on(table.clientId),
    index("oauth_consent_user_id_idx").on(table.userId),
  ],
)

export const oauthClientAssertion = pgTable("oauth_client_assertion", {
  id: text("id").primaryKey(),
  expiresAt: at("expires_at").notNull(),
})
