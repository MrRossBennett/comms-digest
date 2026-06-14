CREATE TYPE "claim_audience_scope" AS ENUM('child', 'group', 'school', 'household', 'unresolved');--> statement-breakpoint
CREATE TYPE "claim_certainty" AS ENUM('confirmed', 'tentative', 'unclear_needs_review', 'contradicted');--> statement-breakpoint
CREATE TYPE "digest_section" AS ENUM('act_now', 'coming_up', 'good_to_know');--> statement-breakpoint
CREATE TABLE "citation" (
	"id" text PRIMARY KEY,
	"claim_id" text NOT NULL,
	"communication_id" text NOT NULL,
	"quote" text NOT NULL,
	"start" integer NOT NULL,
	"end" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim" (
	"id" text PRIMARY KEY,
	"communication_id" text NOT NULL,
	"content" text NOT NULL,
	"audience_scope" "claim_audience_scope" NOT NULL,
	"audience_original_wording" text NOT NULL,
	"certainty" "claim_certainty" NOT NULL,
	"date_original_wording" text,
	"date_resolved" text
);
--> statement-breakpoint
CREATE TABLE "digest_item" (
	"id" text PRIMARY KEY,
	"digest_id" text NOT NULL,
	"section" "digest_section" NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digest_item_child" (
	"digest_item_id" text NOT NULL,
	"child_id" text NOT NULL,
	CONSTRAINT "digest_item_child_pkey" PRIMARY KEY("digest_item_id","child_id")
);
--> statement-breakpoint
CREATE TABLE "digest_item_claim" (
	"digest_item_id" text NOT NULL,
	"claim_id" text NOT NULL,
	CONSTRAINT "digest_item_claim_pkey" PRIMARY KEY("digest_item_id","claim_id")
);
--> statement-breakpoint
CREATE TABLE "digest_item_responsibility" (
	"digest_item_id" text NOT NULL,
	"responsibility_id" text NOT NULL,
	CONSTRAINT "digest_item_responsibility_pkey" PRIMARY KEY("digest_item_id","responsibility_id")
);
--> statement-breakpoint
CREATE TABLE "household_digest" (
	"id" text PRIMARY KEY,
	"household_id" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responsibility" (
	"id" text PRIMARY KEY,
	"household_id" text NOT NULL,
	"title" text NOT NULL,
	"due_date_original_wording" text,
	"due_date_resolved" text,
	"amount_currency" text,
	"amount_minor_units" integer
);
--> statement-breakpoint
CREATE TABLE "responsibility_claim" (
	"responsibility_id" text NOT NULL,
	"claim_id" text NOT NULL,
	CONSTRAINT "responsibility_claim_pkey" PRIMARY KEY("responsibility_id","claim_id")
);
--> statement-breakpoint
CREATE TABLE "school_communication" (
	"id" text PRIMARY KEY,
	"household_id" text NOT NULL,
	"communication_source_id" text,
	"school_id" text,
	"external_message_id" text NOT NULL,
	"sender_address" text NOT NULL,
	"received_at" timestamp NOT NULL,
	"subject" text,
	"source_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "citation_claim_id_idx" ON "citation" ("claim_id");--> statement-breakpoint
CREATE INDEX "citation_communication_id_idx" ON "citation" ("communication_id");--> statement-breakpoint
CREATE INDEX "claim_communication_id_idx" ON "claim" ("communication_id");--> statement-breakpoint
CREATE INDEX "digest_item_digest_id_idx" ON "digest_item" ("digest_id");--> statement-breakpoint
CREATE INDEX "digest_item_child_child_id_idx" ON "digest_item_child" ("child_id");--> statement-breakpoint
CREATE INDEX "digest_item_claim_claim_id_idx" ON "digest_item_claim" ("claim_id");--> statement-breakpoint
CREATE INDEX "digest_item_responsibility_responsibility_id_idx" ON "digest_item_responsibility" ("responsibility_id");--> statement-breakpoint
CREATE UNIQUE INDEX "household_digest_household_id_idx" ON "household_digest" ("household_id");--> statement-breakpoint
CREATE INDEX "responsibility_household_id_idx" ON "responsibility" ("household_id");--> statement-breakpoint
CREATE INDEX "responsibility_claim_claim_id_idx" ON "responsibility_claim" ("claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_communication_household_external_idx" ON "school_communication" ("household_id","external_message_id");--> statement-breakpoint
CREATE INDEX "school_communication_household_id_idx" ON "school_communication" ("household_id");--> statement-breakpoint
CREATE INDEX "school_communication_source_id_idx" ON "school_communication" ("communication_source_id");--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_claim_id_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claim"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_communication_id_school_communication_id_fkey" FOREIGN KEY ("communication_id") REFERENCES "school_communication"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_communication_id_school_communication_id_fkey" FOREIGN KEY ("communication_id") REFERENCES "school_communication"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "digest_item" ADD CONSTRAINT "digest_item_digest_id_household_digest_id_fkey" FOREIGN KEY ("digest_id") REFERENCES "household_digest"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "digest_item_child" ADD CONSTRAINT "digest_item_child_digest_item_id_digest_item_id_fkey" FOREIGN KEY ("digest_item_id") REFERENCES "digest_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "digest_item_child" ADD CONSTRAINT "digest_item_child_child_id_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "digest_item_claim" ADD CONSTRAINT "digest_item_claim_digest_item_id_digest_item_id_fkey" FOREIGN KEY ("digest_item_id") REFERENCES "digest_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "digest_item_claim" ADD CONSTRAINT "digest_item_claim_claim_id_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claim"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "digest_item_responsibility" ADD CONSTRAINT "digest_item_responsibility_digest_item_id_digest_item_id_fkey" FOREIGN KEY ("digest_item_id") REFERENCES "digest_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "digest_item_responsibility" ADD CONSTRAINT "digest_item_responsibility_0jmGdPXTSMUZ_fkey" FOREIGN KEY ("responsibility_id") REFERENCES "responsibility"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "household_digest" ADD CONSTRAINT "household_digest_household_id_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "responsibility" ADD CONSTRAINT "responsibility_household_id_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "responsibility_claim" ADD CONSTRAINT "responsibility_claim_responsibility_id_responsibility_id_fkey" FOREIGN KEY ("responsibility_id") REFERENCES "responsibility"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "responsibility_claim" ADD CONSTRAINT "responsibility_claim_claim_id_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claim"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "school_communication" ADD CONSTRAINT "school_communication_household_id_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "school_communication" ADD CONSTRAINT "school_communication_jtYQdnuDMnmF_fkey" FOREIGN KEY ("communication_source_id") REFERENCES "communication_source"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "school_communication" ADD CONSTRAINT "school_communication_school_id_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE SET NULL;
