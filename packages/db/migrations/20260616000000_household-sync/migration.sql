CREATE TYPE "household_sync_status" AS ENUM('idle', 'running');--> statement-breakpoint
CREATE TABLE "household_sync" (
	"household_id" text PRIMARY KEY,
	"status" "household_sync_status" DEFAULT 'idle' NOT NULL,
	"last_synced_at" timestamp,
	"last_sync_message_count" integer,
	"last_sync_input_tokens" integer,
	"last_sync_output_tokens" integer,
	"last_error" text,
	"needs_reauth" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_run" (
	"id" text PRIMARY KEY,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"households_processed" integer DEFAULT 0 NOT NULL,
	"messages_extracted" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"is_backfill" boolean DEFAULT false NOT NULL,
	"anomaly" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sync_run_started_at_idx" ON "sync_run" ("started_at");--> statement-breakpoint
ALTER TABLE "household_sync" ADD CONSTRAINT "household_sync_household_id_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE;
