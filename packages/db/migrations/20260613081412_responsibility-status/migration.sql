CREATE TYPE "responsibility_status_value" AS ENUM('unresolved', 'completed', 'dismissed', 'superseded');--> statement-breakpoint
CREATE TABLE "responsibility_status" (
	"user_id" text,
	"responsibility_id" text,
	"status" "responsibility_status_value" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "responsibility_status_pkey" PRIMARY KEY("user_id","responsibility_id")
);
--> statement-breakpoint
CREATE INDEX "responsibility_status_user_id_idx" ON "responsibility_status" ("user_id");--> statement-breakpoint
ALTER TABLE "responsibility_status" ADD CONSTRAINT "responsibility_status_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;