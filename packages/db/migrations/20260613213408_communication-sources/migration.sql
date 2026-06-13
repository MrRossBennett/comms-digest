CREATE TYPE "communication_source_audience" AS ENUM('household', 'school', 'children');--> statement-breakpoint
CREATE TYPE "communication_source_discovery" AS ENUM('gmail', 'sample');--> statement-breakpoint
CREATE TYPE "communication_source_status" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TABLE "communication_source" (
	"id" text PRIMARY KEY,
	"household_id" text NOT NULL,
	"school_id" text,
	"sender_name" text NOT NULL,
	"sender_address" text NOT NULL,
	"status" "communication_source_status" DEFAULT 'pending'::"communication_source_status" NOT NULL,
	"audience" "communication_source_audience" DEFAULT 'school'::"communication_source_audience" NOT NULL,
	"discovery" "communication_source_discovery" NOT NULL,
	"message_count" integer DEFAULT 1 NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_source_child" (
	"communication_source_id" text NOT NULL,
	"child_id" text NOT NULL,
	CONSTRAINT "communication_source_child_pkey" PRIMARY KEY("communication_source_id","child_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "communication_source_household_sender_idx" ON "communication_source" ("household_id","sender_address");--> statement-breakpoint
CREATE INDEX "communication_source_household_id_idx" ON "communication_source" ("household_id");--> statement-breakpoint
CREATE INDEX "communication_source_school_id_idx" ON "communication_source" ("school_id");--> statement-breakpoint
CREATE INDEX "communication_source_child_child_id_idx" ON "communication_source_child" ("child_id");--> statement-breakpoint
ALTER TABLE "communication_source" ADD CONSTRAINT "communication_source_household_id_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "communication_source" ADD CONSTRAINT "communication_source_school_id_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "communication_source_child" ADD CONSTRAINT "communication_source_child_x6aF2Erech6p_fkey" FOREIGN KEY ("communication_source_id") REFERENCES "communication_source"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "communication_source_child" ADD CONSTRAINT "communication_source_child_child_id_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child"("id") ON DELETE CASCADE;
