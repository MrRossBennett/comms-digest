CREATE TABLE "household_routine" (
	"id" text PRIMARY KEY,
	"household_id" text NOT NULL,
	"school_id" text,
	"title" text NOT NULL,
	"details" text,
	"weekdays" integer[] NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_routine_child" (
	"routine_id" text NOT NULL,
	"child_id" text NOT NULL,
	CONSTRAINT "household_routine_child_pkey" PRIMARY KEY("routine_id","child_id")
);
--> statement-breakpoint
CREATE INDEX "household_routine_household_id_idx" ON "household_routine" ("household_id");--> statement-breakpoint
CREATE INDEX "household_routine_child_child_id_idx" ON "household_routine_child" ("child_id");--> statement-breakpoint
ALTER TABLE "household_routine" ADD CONSTRAINT "household_routine_household_id_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "household_routine" ADD CONSTRAINT "household_routine_school_id_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "household_routine_child" ADD CONSTRAINT "household_routine_child_routine_id_household_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "household_routine"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "household_routine_child" ADD CONSTRAINT "household_routine_child_child_id_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child"("id") ON DELETE CASCADE;
