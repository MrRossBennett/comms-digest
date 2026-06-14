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

import { communicationSource, communicationSourceAudience } from "./communication-source.schema";
import { child, household, school } from "./household.schema";

export const claimAudienceScope = pgEnum("claim_audience_scope", [
  "child",
  "group",
  "school",
  "household",
  "unresolved",
]);

export const claimCertainty = pgEnum("claim_certainty", [
  "confirmed",
  "tentative",
  "unclear_needs_review",
  "contradicted",
]);

export const digestSection = pgEnum("digest_section", ["act_now", "coming_up", "good_to_know"]);

export const schoolCommunication = pgTable(
  "school_communication",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    communicationSourceId: text("communication_source_id").references(
      () => communicationSource.id,
      { onDelete: "set null" },
    ),
    schoolId: text("school_id").references(() => school.id),
    sourceAudience: communicationSourceAudience("source_audience").notNull(),
    externalMessageId: text("external_message_id").notNull(),
    senderAddress: text("sender_address").notNull(),
    receivedAt: timestamp("received_at").notNull(),
    subject: text("subject"),
    sourceText: text("source_text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("school_communication_household_external_idx").on(
      table.householdId,
      table.externalMessageId,
    ),
    index("school_communication_household_id_idx").on(table.householdId),
    index("school_communication_source_id_idx").on(table.communicationSourceId),
  ],
);

export const schoolCommunicationChild = pgTable(
  "school_communication_child",
  {
    communicationId: text("communication_id")
      .notNull()
      .references(() => schoolCommunication.id, { onDelete: "cascade" }),
    childId: text("child_id")
      .notNull()
      .references(() => child.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.communicationId, table.childId] }),
    index("school_communication_child_child_id_idx").on(table.childId),
  ],
);

export const claim = pgTable(
  "claim",
  {
    id: text("id").primaryKey(),
    communicationId: text("communication_id")
      .notNull()
      .references(() => schoolCommunication.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    audienceScope: claimAudienceScope("audience_scope").notNull(),
    audienceOriginalWording: text("audience_original_wording").notNull(),
    certainty: claimCertainty("certainty").notNull(),
    dateOriginalWording: text("date_original_wording"),
    dateResolved: text("date_resolved"),
  },
  (table) => [index("claim_communication_id_idx").on(table.communicationId)],
);

export const citation = pgTable(
  "citation",
  {
    id: text("id").primaryKey(),
    claimId: text("claim_id")
      .notNull()
      .references(() => claim.id, { onDelete: "cascade" }),
    communicationId: text("communication_id")
      .notNull()
      .references(() => schoolCommunication.id, { onDelete: "cascade" }),
    quote: text("quote").notNull(),
    start: integer("start").notNull(),
    end: integer("end").notNull(),
  },
  (table) => [
    index("citation_claim_id_idx").on(table.claimId),
    index("citation_communication_id_idx").on(table.communicationId),
  ],
);

export const responsibility = pgTable(
  "responsibility",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDateOriginalWording: text("due_date_original_wording"),
    dueDateResolved: text("due_date_resolved"),
    amountCurrency: text("amount_currency"),
    amountMinorUnits: integer("amount_minor_units"),
  },
  (table) => [index("responsibility_household_id_idx").on(table.householdId)],
);

export const responsibilityClaim = pgTable(
  "responsibility_claim",
  {
    responsibilityId: text("responsibility_id")
      .notNull()
      .references(() => responsibility.id, { onDelete: "cascade" }),
    claimId: text("claim_id")
      .notNull()
      .references(() => claim.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.responsibilityId, table.claimId] }),
    index("responsibility_claim_claim_id_idx").on(table.claimId),
  ],
);

export const householdDigest = pgTable(
  "household_digest",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("household_digest_household_id_idx").on(table.householdId)],
);

export const digestItem = pgTable(
  "digest_item",
  {
    id: text("id").primaryKey(),
    digestId: text("digest_id")
      .notNull()
      .references(() => householdDigest.id, { onDelete: "cascade" }),
    section: digestSection("section").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [index("digest_item_digest_id_idx").on(table.digestId)],
);

export const digestItemChild = pgTable(
  "digest_item_child",
  {
    digestItemId: text("digest_item_id")
      .notNull()
      .references(() => digestItem.id, { onDelete: "cascade" }),
    childId: text("child_id")
      .notNull()
      .references(() => child.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.digestItemId, table.childId] }),
    index("digest_item_child_child_id_idx").on(table.childId),
  ],
);

export const digestItemClaim = pgTable(
  "digest_item_claim",
  {
    digestItemId: text("digest_item_id")
      .notNull()
      .references(() => digestItem.id, { onDelete: "cascade" }),
    claimId: text("claim_id")
      .notNull()
      .references(() => claim.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.digestItemId, table.claimId] }),
    index("digest_item_claim_claim_id_idx").on(table.claimId),
  ],
);

export const digestItemResponsibility = pgTable(
  "digest_item_responsibility",
  {
    digestItemId: text("digest_item_id")
      .notNull()
      .references(() => digestItem.id, { onDelete: "cascade" }),
    responsibilityId: text("responsibility_id")
      .notNull()
      .references(() => responsibility.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.digestItemId, table.responsibilityId] }),
    index("digest_item_responsibility_responsibility_id_idx").on(table.responsibilityId),
  ],
);
