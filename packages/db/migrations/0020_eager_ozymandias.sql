CREATE TYPE "public"."oauth_consent_intent_state" AS ENUM('pending', 'completed', 'superseded', 'failed');--> statement-breakpoint
CREATE TABLE "agent_access_connection_last_auth" (
	"authorization_code_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"last_authenticated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_access_oauth_consent_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"oauth_consent_id" text NOT NULL,
	"authorization_code_id" text NOT NULL,
	"resource_url" text NOT NULL,
	"redirect_uri" text,
	"requested_scopes" jsonb,
	"state" "oauth_consent_intent_state" DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_access_connection_last_auth" ADD CONSTRAINT "agent_access_connection_last_auth_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_access_connection_last_auth" ADD CONSTRAINT "agent_access_connection_last_auth_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_access_oauth_consent_intents" ADD CONSTRAINT "agent_access_oauth_consent_intents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_access_oauth_consent_intents" ADD CONSTRAINT "agent_access_oauth_consent_intents_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_access_oauth_consent_intents" ADD CONSTRAINT "agent_access_oauth_consent_intents_oauth_consent_id_oauth_consent_id_fk" FOREIGN KEY ("oauth_consent_id") REFERENCES "public"."oauth_consent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_access_connection_last_auth_user_idx" ON "agent_access_connection_last_auth" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_access_connection_last_auth_client_idx" ON "agent_access_connection_last_auth" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "agent_access_oauth_consent_intents_user_idx" ON "agent_access_oauth_consent_intents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_access_oauth_consent_intents_client_idx" ON "agent_access_oauth_consent_intents" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_access_oauth_consent_intents_consent_uidx" ON "agent_access_oauth_consent_intents" USING btree ("oauth_consent_id");