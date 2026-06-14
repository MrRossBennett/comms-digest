CREATE TABLE "school_communication_child" (
	"communication_id" text NOT NULL,
	"child_id" text NOT NULL,
	CONSTRAINT "school_communication_child_pkey" PRIMARY KEY("communication_id","child_id")
);
--> statement-breakpoint
CREATE INDEX "school_communication_child_child_id_idx" ON "school_communication_child" ("child_id");--> statement-breakpoint
ALTER TABLE "school_communication_child" ADD CONSTRAINT "school_communication_child_Yrs4h3WaRR71_fkey" FOREIGN KEY ("communication_id") REFERENCES "school_communication"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "school_communication_child" ADD CONSTRAINT "school_communication_child_child_id_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "child"("id") ON DELETE CASCADE;
