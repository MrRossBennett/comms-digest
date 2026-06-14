ALTER TABLE "school_communication" ADD COLUMN "source_audience" "communication_source_audience";--> statement-breakpoint
UPDATE "school_communication"
SET "source_audience" = "communication_source"."audience"
FROM "communication_source"
WHERE "school_communication"."communication_source_id" = "communication_source"."id";--> statement-breakpoint
UPDATE "school_communication"
SET "source_audience" = 'school'
WHERE "source_audience" IS NULL;--> statement-breakpoint
ALTER TABLE "school_communication" ALTER COLUMN "source_audience" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "school_communication" DROP CONSTRAINT "school_communication_school_id_school_id_fkey", ADD CONSTRAINT "school_communication_school_id_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id");
