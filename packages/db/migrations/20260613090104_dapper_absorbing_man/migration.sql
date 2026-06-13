CREATE TABLE "child" (
	"id" text PRIMARY KEY,
	"household_id" text NOT NULL,
	"school_id" text NOT NULL,
	"display_name" text NOT NULL,
	"school_year" text NOT NULL,
	"class_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household" (
	"id" text PRIMARY KEY,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school" (
	"id" text PRIMARY KEY,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "child_household_id_idx" ON "child" ("household_id");--> statement-breakpoint
CREATE INDEX "child_school_id_idx" ON "child" ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "household_owner_user_id_idx" ON "household" ("owner_user_id");--> statement-breakpoint
CREATE INDEX "school_household_id_idx" ON "school" ("household_id");--> statement-breakpoint
ALTER TABLE "child" ADD CONSTRAINT "child_household_id_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "child" ADD CONSTRAINT "child_school_id_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "household" ADD CONSTRAINT "household_owner_user_id_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "school" ADD CONSTRAINT "school_household_id_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE;