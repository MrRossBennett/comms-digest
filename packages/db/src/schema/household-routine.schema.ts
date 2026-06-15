import { date, index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { child, household, school } from "./household.schema";

export const householdRoutine = pgTable(
  "household_routine",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    schoolId: text("school_id").references(() => school.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    details: text("details"),
    weekdays: integer("weekdays").array().notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("household_routine_household_id_idx").on(table.householdId)],
);

export const householdRoutineChild = pgTable(
  "household_routine_child",
  {
    routineId: text("routine_id")
      .notNull()
      .references(() => householdRoutine.id, { onDelete: "cascade" }),
    childId: text("child_id")
      .notNull()
      .references(() => child.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.routineId, table.childId] }),
    index("household_routine_child_child_id_idx").on(table.childId),
  ],
);
