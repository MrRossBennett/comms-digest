import { boolean, index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { household } from "./household.schema";

export const householdSyncStatus = pgEnum("household_sync_status", ["idle", "running"]);

// Per-Household sync state. Concurrency (one sync at a time per Household) is enforced by
// Inngest's concurrencyKey — this row is a status surface for the UI, not a lock.
export const householdSync = pgTable("household_sync", {
  householdId: text("household_id")
    .primaryKey()
    .references(() => household.id, { onDelete: "cascade" }),
  status: householdSyncStatus("status").default("idle").notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  lastSyncMessageCount: integer("last_sync_message_count"),
  lastSyncInputTokens: integer("last_sync_input_tokens"),
  lastSyncOutputTokens: integer("last_sync_output_tokens"),
  lastError: text("last_error"),
  needsReauth: boolean("needs_reauth").default(false).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Per-sweep aggregate record. Captures spend so the future enforced cap can be sized
// against real data (see: docs/adr/0011, Deliberately Deferred — enforced spend cap).
export const syncRun = pgTable(
  "sync_run",
  {
    id: text("id").primaryKey(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    householdsProcessed: integer("households_processed").default(0).notNull(),
    messagesExtracted: integer("messages_extracted").default(0).notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    failureCount: integer("failure_count").default(0).notNull(),
    isBackfill: boolean("is_backfill").default(false).notNull(),
    anomaly: boolean("anomaly").default(false).notNull(),
  },
  (table) => [index("sync_run_started_at_idx").on(table.startedAt)],
);
