import { index, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.schema";
import { claim } from "./intelligence.schema";

export const responsibilityStatusValue = pgEnum("responsibility_status_value", [
  "unresolved",
  "completed",
  "dismissed",
  "superseded",
]);

export const responsibilityStatus = pgTable(
  "responsibility_status",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    responsibilityId: text("responsibility_id").notNull(),
    status: responsibilityStatusValue("status").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.responsibilityId] }),
    index("responsibility_status_user_id_idx").on(table.userId),
  ],
);

export const claimStatusValue = pgEnum("claim_status_value", ["dismissed"]);

export const claimStatus = pgTable(
  "claim_status",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    claimId: text("claim_id")
      .notNull()
      .references(() => claim.id, { onDelete: "cascade" }),
    status: claimStatusValue("status").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.claimId] }),
    index("claim_status_user_id_idx").on(table.userId),
  ],
);
