CREATE TABLE "repository_installation_deliveries" (
	"project_id" uuid NOT NULL,
	"installation_id" uuid NOT NULL,
	"delivery_id" text NOT NULL,
	"action" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repository_installation_deliveries_project_id_installation_id_delivery_id_pk" PRIMARY KEY("project_id","installation_id","delivery_id")
);
--> statement-breakpoint
CREATE TABLE "repository_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"binding_id" uuid NOT NULL,
	"host" text NOT NULL,
	"runtime" text NOT NULL,
	"repository" text NOT NULL,
	"service" text NOT NULL,
	"environment" text NOT NULL,
	"external_installation_id" text NOT NULL,
	"policy" jsonb NOT NULL,
	"status" text DEFAULT 'pending-verification' NOT NULL,
	"cold_start_status" text DEFAULT 'pending-deployment-receipt' NOT NULL,
	"pr_branch" text,
	"pr_number" integer,
	"pr_url" text,
	"pr_head_sha" text,
	"verified_run_id" uuid,
	"verified_at" timestamp with time zone,
	"delegated_authorization_code_id" text,
	"delegated_client_id" text,
	"delegated_user_id" text,
	"last_event_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repository_installations_project_id_host_repository_service_environment_unique" UNIQUE("project_id","host","repository","service","environment"),
	CONSTRAINT "repository_installations_project_id_id_unique" UNIQUE("project_id","id")
);
--> statement-breakpoint
ALTER TABLE "repository_installation_deliveries" ADD CONSTRAINT "repository_installation_deliveries_project_id_installation_id_repository_installations_project_id_id_fk" FOREIGN KEY ("project_id","installation_id") REFERENCES "public"."repository_installations"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_installations" ADD CONSTRAINT "repository_installations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_installations" ADD CONSTRAINT "repository_installations_project_id_binding_id_deployment_bindings_project_id_id_fk" FOREIGN KEY ("project_id","binding_id") REFERENCES "public"."deployment_bindings"("project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repository_installations_external_idx" ON "repository_installations" USING btree ("host","external_installation_id");