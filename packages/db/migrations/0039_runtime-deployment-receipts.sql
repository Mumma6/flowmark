CREATE TABLE "deployment_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"repository" text NOT NULL,
	"service" text NOT NULL,
	"environment" text NOT NULL,
	"secret_hash" text NOT NULL,
	CONSTRAINT "deployment_bindings_project_id_repository_service_environment_unique" UNIQUE("project_id","repository","service","environment"),
	CONSTRAINT "deployment_bindings_project_id_id_unique" UNIQUE("project_id","id")
);
--> statement-breakpoint
CREATE TABLE "deployment_receipts" (
	"project_id" uuid NOT NULL,
	"binding_id" uuid NOT NULL,
	"deployment_id" text NOT NULL,
	"manifest_digest" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deployment_receipts_project_id_binding_id_deployment_id_pk" PRIMARY KEY("project_id","binding_id","deployment_id")
);
--> statement-breakpoint
ALTER TABLE "deployment_bindings" ADD CONSTRAINT "deployment_bindings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_receipts" ADD CONSTRAINT "deployment_receipts_project_id_binding_id_deployment_bindings_project_id_id_fk" FOREIGN KEY ("project_id","binding_id") REFERENCES "public"."deployment_bindings"("project_id","id") ON DELETE cascade ON UPDATE no action;