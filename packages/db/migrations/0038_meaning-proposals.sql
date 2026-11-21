ALTER TABLE "shared_investigations" ADD COLUMN "meaning_proposal" jsonb;--> statement-breakpoint
ALTER TABLE "shared_investigations" ADD COLUMN "proposal_resolution" text;--> statement-breakpoint
ALTER TABLE "shared_investigations" ADD COLUMN "proposal_resolved_by" text;--> statement-breakpoint
ALTER TABLE "shared_investigations" ADD COLUMN "proposal_resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shared_investigations" ADD CONSTRAINT "shared_investigations_proposal_resolved_by_user_id_fk" FOREIGN KEY ("proposal_resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE OR REPLACE FUNCTION flowmark_reject_shared_investigation_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.meaning_proposal IS NOT NULL
    AND (to_jsonb(OLD) - ARRAY['proposal_resolution', 'proposal_resolved_by', 'proposal_resolved_at'])
      = (to_jsonb(NEW) - ARRAY['proposal_resolution', 'proposal_resolved_by', 'proposal_resolved_at'])
  THEN
    IF OLD.proposal_resolution IS NULL
      AND NEW.proposal_resolution IN ('accepted', 'rejected')
      AND NEW.proposal_resolved_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = OLD.project_id AND user_id = NEW.proposal_resolved_by AND role = 'owner'
      )
    THEN
      RETURN NEW;
    END IF;

    -- Account erasure can clear a deleted resolver through the foreign key.
    IF OLD.proposal_resolved_by IS NOT NULL AND NEW.proposal_resolved_by IS NULL
      AND NEW.proposal_resolution IS NOT DISTINCT FROM OLD.proposal_resolution
      AND NEW.proposal_resolved_at IS NOT DISTINCT FROM OLD.proposal_resolved_at
    THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Shared investigation evidence is immutable' USING ERRCODE = '23514';
END;
$$;
