import { db } from "@repo/db";
import { householdDigest } from "@repo/db/schema";
import { composeDigest, reconcileDigest } from "@repo/intelligence";
import { eq } from "drizzle-orm";

import {
  listCompletedResponsibilityIds,
  listDismissedDigestEvidenceIds,
} from "./evidence-status.server";
import { getHouseholdForOwner } from "./household.server";
import { loadExtractions } from "./stored-evidence.server";

export async function getHouseholdDigestForOwner(ownerUserId: string) {
  const householdSetup = await getHouseholdForOwner(ownerUserId);
  if (!householdSetup) return null;

  const [digestRow] = await db
    .select({ generatedAt: householdDigest.generatedAt })
    .from(householdDigest)
    .where(eq(householdDigest.householdId, householdSetup.id))
    .limit(1);

  const extractions = await loadExtractions(householdSetup.id);
  if (!digestRow || extractions.length === 0) {
    return {
      household: householdSetup,
      generatedAt: null,
      digest: null,
      communications: [],
      completedResponsibilityIds: [],
      dismissedClaimIds: [],
      dismissedResponsibilityIds: [],
      receivedAtByResponsibilityId: {},
    };
  }

  // Each Responsibility is extracted from exactly one communication, so we can
  // fall back to that email's date when it carries no resolved deadline.
  const receivedAtByResponsibilityId: Record<string, string> = {};
  for (const extraction of extractions) {
    for (const responsibility of extraction.responsibilities) {
      receivedAtByResponsibilityId[responsibility.id] = extraction.communication.receivedAt;
    }
  }

  const householdConfig = {
    children: householdSetup.children.map((householdChild) => ({
      id: householdChild.id,
      name: householdChild.displayName,
      schoolYear: householdChild.schoolYear,
      schoolId: householdChild.schoolId,
    })),
  };
  const digest = composeDigest({
    household: householdConfig,
    extractions,
    reconciliation: reconcileDigest({ household: householdConfig, extractions }),
  });
  const dismissed = await listDismissedDigestEvidenceIds(ownerUserId);

  return {
    household: householdSetup,
    generatedAt: digestRow.generatedAt,
    digest,
    communications: extractions.map(({ communication }) => communication),
    completedResponsibilityIds: await listCompletedResponsibilityIds(ownerUserId),
    dismissedClaimIds: dismissed.claimIds,
    dismissedResponsibilityIds: dismissed.responsibilityIds,
    receivedAtByResponsibilityId,
  };
}
