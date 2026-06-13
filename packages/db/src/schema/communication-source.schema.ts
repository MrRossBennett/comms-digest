import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { child, household, school } from "./household.schema";

export const communicationSourceStatus = pgEnum("communication_source_status", [
  "pending",
  "confirmed",
  "rejected",
]);

export const communicationSourceAudience = pgEnum("communication_source_audience", [
  "household",
  "school",
  "children",
]);

export const communicationSourceDiscovery = pgEnum("communication_source_discovery", [
  "gmail",
  "sample",
]);

export const communicationSource = pgTable(
  "communication_source",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    schoolId: text("school_id").references(() => school.id, { onDelete: "cascade" }),
    senderName: text("sender_name").notNull(),
    senderAddress: text("sender_address").notNull(),
    status: communicationSourceStatus("status").default("pending").notNull(),
    audience: communicationSourceAudience("audience").default("school").notNull(),
    discovery: communicationSourceDiscovery("discovery").notNull(),
    messageCount: integer("message_count").default(1).notNull(),
    lastSeenAt: timestamp("last_seen_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("communication_source_household_sender_idx").on(
      table.householdId,
      table.senderAddress,
    ),
    index("communication_source_household_id_idx").on(table.householdId),
    index("communication_source_school_id_idx").on(table.schoolId),
  ],
);

export const communicationSourceChild = pgTable(
  "communication_source_child",
  {
    communicationSourceId: text("communication_source_id")
      .notNull()
      .references(() => communicationSource.id, { onDelete: "cascade" }),
    childId: text("child_id")
      .notNull()
      .references(() => child.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.communicationSourceId, table.childId],
    }),
    index("communication_source_child_child_id_idx").on(table.childId),
  ],
);
