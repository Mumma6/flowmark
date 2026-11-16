import { and, eq, ne } from "drizzle-orm"
import { Effect } from "effect"
import { randomUUID } from "node:crypto"
import {
  oauthClient,
  oauthClientResource,
  oauthResource,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

const clientRowId = "flowmark-cursor"

export type CursorMcpClientRegistration = {
  readonly clientId: string
  readonly redirectUris: readonly string[]
  readonly scopes: readonly string[]
}

/** Idempotent public Cursor client. PKCE, no secret, exact redirect allowlist. */
export const ensureCursorMcpClient = Effect.fn("ensureCursorMcpClient")(
  function* (input: {
    readonly resourceUrl: string
    readonly client: CursorMcpClientRegistration
    readonly replaceOtherResources: boolean
  }) {
    const db = yield* Database
    const now = new Date()
    const { client, resourceUrl, replaceOtherResources } = input
    yield* runQuery(DatabaseOperation.EnsureCursorMcpClient, () =>
      db.transaction(async (tx) => {
        await tx
          .insert(oauthResource)
          .values({
            id: randomUUID(),
            identifier: resourceUrl,
            name: "Flowmark",
            allowedScopes: [...client.scopes],
            disabled: false,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: oauthResource.identifier,
            set: {
              name: "Flowmark",
              allowedScopes: [...client.scopes],
              disabled: false,
              updatedAt: now,
            },
          })
        await tx
          .insert(oauthClient)
          .values({
            id: clientRowId,
            clientId: client.clientId,
            clientSecret: null,
            disabled: false,
            skipConsent: false,
            name: "Cursor",
            redirectUris: [...client.redirectUris],
            tokenEndpointAuthMethod: "none",
            applicationType: "native",
            grantTypes: ["authorization_code", "refresh_token"],
            responseTypes: ["code"],
            requirePKCE: true,
            scopes: [...client.scopes],
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: oauthClient.clientId,
            set: {
              clientSecret: null,
              disabled: false,
              skipConsent: false,
              name: "Cursor",
              redirectUris: [...client.redirectUris],
              tokenEndpointAuthMethod: "none",
              applicationType: "native",
              grantTypes: ["authorization_code", "refresh_token"],
              responseTypes: ["code"],
              requirePKCE: true,
              scopes: [...client.scopes],
              updatedAt: now,
            },
          })
        if (replaceOtherResources) {
          await tx
            .delete(oauthClientResource)
            .where(
              and(
                eq(oauthClientResource.clientId, client.clientId),
                ne(oauthClientResource.resourceId, resourceUrl),
              ),
            )
        }
        await tx
          .insert(oauthClientResource)
          .values({
            id: randomUUID(),
            clientId: client.clientId,
            resourceId: resourceUrl,
            createdAt: now,
          })
          .onConflictDoNothing({
            target: [
              oauthClientResource.clientId,
              oauthClientResource.resourceId,
            ],
          })
      }),
    )
  },
)
