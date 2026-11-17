CREATE TABLE "registration_invitations" (
	"email" text PRIMARY KEY NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_invitation_email_normalized" CHECK ("registration_invitations"."email" = lower(btrim("registration_invitations"."email")))
);
