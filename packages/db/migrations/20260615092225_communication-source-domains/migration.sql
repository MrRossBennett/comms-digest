ALTER TYPE "communication_source_discovery" ADD VALUE 'manual' BEFORE 'sample';--> statement-breakpoint
ALTER TABLE "communication_source" ADD COLUMN "sender_domain" text;--> statement-breakpoint
UPDATE "communication_source"
SET "sender_domain" = CASE
	WHEN strpos("sender_address", '@') > 0
		THEN lower(split_part("sender_address", '@', 2))
	ELSE lower("sender_address")
END;--> statement-breakpoint
ALTER TABLE "communication_source" ALTER COLUMN "sender_domain" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "communication_source_household_domain_idx" ON "communication_source" ("household_id","sender_domain");
