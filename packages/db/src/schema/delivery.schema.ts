import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { household } from "./household.schema";

export const deliveryContactConsent = pgEnum("delivery_contact_consent", [
  "unverified",
  "opted_in",
  "opted_out",
]);

export const dayPlanDeliveryStatus = pgEnum("day_plan_delivery_status", [
  "attempting",
  "skipped",
  "sent",
  "delivered",
  "failed",
]);

export const deliveryContact = pgTable(
  "delivery_contact",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    consent: deliveryContactConsent("consent").default("unverified").notNull(),
    verificationCodeHash: text("verification_code_hash"),
    verificationExpiresAt: timestamp("verification_expires_at"),
    verificationAttemptsRemaining: integer("verification_attempts_remaining"),
    verificationRequestedAt: timestamp("verification_requested_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("delivery_contact_household_id_idx").on(table.householdId),
    uniqueIndex("delivery_contact_phone_number_idx").on(table.phoneNumber),
  ],
);

export const dayPlanDelivery = pgTable(
  "day_plan_delivery",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    planDate: date("plan_date", { mode: "string" }).notNull(),
    planSnapshot: jsonb("plan_snapshot").notNull(),
    messageText: text("message_text"),
    status: dayPlanDeliveryStatus("status").notNull(),
    providerMessageId: text("provider_message_id"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("day_plan_delivery_household_date_idx").on(table.householdId, table.planDate),
    index("day_plan_delivery_provider_message_id_idx").on(table.providerMessageId),
  ],
);
