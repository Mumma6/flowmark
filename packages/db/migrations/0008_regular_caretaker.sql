ALTER TABLE "user" ADD COLUMN "onboarding_step" text DEFAULT 'project' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "user"
SET "onboarding_step" = 'run',
    "onboarding_completed_at" = COALESCE("updated_at", now())
WHERE "onboarding_completed_at" IS NULL;