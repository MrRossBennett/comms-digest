CREATE TYPE "delivery_contact_consent" AS ENUM('unverified', 'opted_in', 'opted_out');--> statement-breakpoint
CREATE TYPE "day_plan_delivery_status" AS ENUM('attempting', 'skipped', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TABLE "delivery_contact" (
	"id" text PRIMARY KEY,
	"household_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"consent" "delivery_contact_consent" DEFAULT 'unverified' NOT NULL,
	"verification_code_hash" text,
	"verification_expires_at" timestamp,
	"verification_attempts_remaining" integer,
	"verification_requested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_plan_delivery" (
	"id" text PRIMARY KEY,
	"household_id" text NOT NULL,
	"plan_date" date NOT NULL,
	"plan_snapshot" jsonb NOT NULL,
	"message_text" text,
	"status" "day_plan_delivery_status" NOT NULL,
	"provider_message_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_contact_household_id_idx" ON "delivery_contact" ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_contact_phone_number_idx" ON "delivery_contact" ("phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "day_plan_delivery_household_date_idx" ON "day_plan_delivery" ("household_id","plan_date");--> statement-breakpoint
CREATE INDEX "day_plan_delivery_provider_message_id_idx" ON "day_plan_delivery" ("provider_message_id");--> statement-breakpoint
ALTER TABLE "delivery_contact" ADD CONSTRAINT "delivery_contact_household_id_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "day_plan_delivery" ADD CONSTRAINT "day_plan_delivery_household_id_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE;
