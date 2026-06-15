CREATE TEMP TABLE "communication_source_domain_merge" AS
SELECT
	"id" AS "source_id",
	first_value("id") OVER (
		PARTITION BY "household_id", "sender_domain"
		ORDER BY
			CASE "status"
				WHEN 'confirmed' THEN 0
				WHEN 'pending' THEN 1
				ELSE 2
			END,
			"updated_at" DESC,
			"id"
	) AS "keeper_id"
FROM "communication_source";--> statement-breakpoint
UPDATE "school_communication"
SET "communication_source_id" = "communication_source_domain_merge"."keeper_id"
FROM "communication_source_domain_merge"
WHERE
	"school_communication"."communication_source_id" = "communication_source_domain_merge"."source_id"
	AND "communication_source_domain_merge"."source_id" <> "communication_source_domain_merge"."keeper_id";--> statement-breakpoint
DELETE FROM "communication_source"
USING "communication_source_domain_merge"
WHERE
	"communication_source"."id" = "communication_source_domain_merge"."source_id"
	AND "communication_source_domain_merge"."source_id" <> "communication_source_domain_merge"."keeper_id";--> statement-breakpoint
DROP TABLE "communication_source_domain_merge";--> statement-breakpoint
DROP INDEX "communication_source_household_domain_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "communication_source_household_domain_idx" ON "communication_source" ("household_id","sender_domain");
