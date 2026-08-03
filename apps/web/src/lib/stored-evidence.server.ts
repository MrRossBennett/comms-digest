import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import {
  citation as citationTable,
  claim as claimTable,
  responsibility as responsibilityTable,
  responsibilityClaim,
  schoolCommunication,
  schoolCommunicationChild,
} from "@repo/db/schema";
import { type ValidatedExtraction } from "@repo/intelligence";
import { asc, eq, inArray } from "drizzle-orm";

import type { IngestionCandidate } from "./communication-fetcher";
import { fromStoredEvidenceRows, toStoredEvidenceRows } from "./stored-evidence";

export async function persistExtraction(
  householdId: string,
  candidate: IngestionCandidate,
  extraction: ValidatedExtraction,
) {
  const rows = toStoredEvidenceRows(extraction, {
    householdId,
    communicationSourceId: candidate.source.id,
    sourceAudience: candidate.source.audience,
    externalMessageId: candidate.externalMessageId,
    senderAddress: candidate.senderAddress,
  });

  await db.transaction(async (transaction) => {
    const inserted = await transaction
      .insert(schoolCommunication)
      .values(rows.communication)
      .onConflictDoNothing({
        target: [schoolCommunication.householdId, schoolCommunication.externalMessageId],
      })
      .returning({ id: schoolCommunication.id });

    if (inserted.length === 0) return;

    if (rows.communicationChildren.length > 0) {
      await transaction.insert(schoolCommunicationChild).values(rows.communicationChildren);
    }

    if (rows.claims.length > 0) {
      await transaction.insert(claimTable).values(rows.claims);
      await transaction.insert(citationTable).values(rows.citations);
    }

    if (rows.responsibilities.length > 0) {
      await transaction.insert(responsibilityTable).values(rows.responsibilities);
      await transaction.insert(responsibilityClaim).values(rows.responsibilityClaims);
    }
  });
}

export async function loadExtractions(householdId: string) {
  const communications = await db
    .select()
    .from(schoolCommunication)
    .where(eq(schoolCommunication.householdId, householdId))
    .orderBy(asc(schoolCommunication.receivedAt));
  if (communications.length === 0) return [];

  const communicationIds = communications.map(({ id }) => id);
  const claims = await db
    .select()
    .from(claimTable)
    .where(inArray(claimTable.communicationId, communicationIds));
  const citations = await db
    .select()
    .from(citationTable)
    .where(inArray(citationTable.communicationId, communicationIds));
  const sourceChildren = await db
    .select()
    .from(schoolCommunicationChild)
    .where(inArray(schoolCommunicationChild.communicationId, communicationIds));
  const claimIds = claims.map(({ id }) => id);
  const responsibilityLinks =
    claimIds.length === 0
      ? []
      : await db
          .select()
          .from(responsibilityClaim)
          .where(inArray(responsibilityClaim.claimId, claimIds));
  const responsibilityIds = [
    ...new Set(responsibilityLinks.map(({ responsibilityId }) => responsibilityId)),
  ];
  const responsibilities =
    responsibilityIds.length === 0
      ? []
      : await db
          .select()
          .from(responsibilityTable)
          .where(inArray(responsibilityTable.id, responsibilityIds));

  return communications.map((communication) =>
    fromStoredEvidenceRows({
      communication,
      communicationChildren: sourceChildren,
      claims,
      citations,
      responsibilities,
      responsibilityClaims: responsibilityLinks,
    }),
  );
}
