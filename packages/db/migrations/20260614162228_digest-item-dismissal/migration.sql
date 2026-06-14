CREATE TYPE "claim_status_value" AS ENUM('dismissed');--> statement-breakpoint
CREATE TABLE "claim_status" (
	"user_id" text,
	"claim_id" text,
	"status" "claim_status_value" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "claim_status_pkey" PRIMARY KEY("user_id","claim_id")
);
--> statement-breakpoint
CREATE INDEX "claim_status_user_id_idx" ON "claim_status" ("user_id");--> statement-breakpoint
ALTER TABLE "claim_status" ADD CONSTRAINT "claim_status_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "claim_status" ADD CONSTRAINT "claim_status_claim_id_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claim"("id") ON DELETE CASCADE;