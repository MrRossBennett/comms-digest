import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import {
  claim,
  claimStatus,
  household,
  responsibility,
  responsibilityStatus,
  schoolCommunication,
} from "@repo/db/schema";
import { isDemoResponsibilityId } from "@repo/intelligence/demo";
import { and, eq, inArray } from "drizzle-orm";

import { type EvidenceStatusPlan, planEvidenceStatus } from "./evidence-status";

export async function listCompletedResponsibilityIds(ownerUserId: string) {
  const rows = await db
    .select({ responsibilityId: responsibilityStatus.responsibilityId })
    .from(responsibilityStatus)
    .innerJoin(responsibility, eq(responsibilityStatus.responsibilityId, responsibility.id))
    .innerJoin(household, eq(responsibility.householdId, household.id))
    .where(
      and(
        eq(responsibilityStatus.userId, ownerUserId),
        eq(responsibilityStatus.status, "completed"),
        eq(household.ownerUserId, ownerUserId),
      ),
    );

  return rows.map(({ responsibilityId }) => responsibilityId);
}

export async function listDemoCompletedResponsibilityIds(ownerUserId: string) {
  const rows = await db
    .select({ responsibilityId: responsibilityStatus.responsibilityId })
    .from(responsibilityStatus)
    .where(
      and(
        eq(responsibilityStatus.userId, ownerUserId),
        eq(responsibilityStatus.status, "completed"),
      ),
    );
  const demoMatches = await Promise.all(
    rows.map(async ({ responsibilityId }) => ({
      responsibilityId,
      isDemo: await isDemoResponsibilityId(responsibilityId),
    })),
  );

  return demoMatches.filter(({ isDemo }) => isDemo).map(({ responsibilityId }) => responsibilityId);
}

export async function listDismissedDigestEvidenceIds(ownerUserId: string) {
  const [claims, responsibilities] = await Promise.all([
    db
      .select({ claimId: claimStatus.claimId })
      .from(claimStatus)
      .innerJoin(claim, eq(claimStatus.claimId, claim.id))
      .innerJoin(schoolCommunication, eq(claim.communicationId, schoolCommunication.id))
      .innerJoin(household, eq(schoolCommunication.householdId, household.id))
      .where(
        and(
          eq(claimStatus.userId, ownerUserId),
          eq(claimStatus.status, "dismissed"),
          eq(household.ownerUserId, ownerUserId),
        ),
      ),
    db
      .select({ responsibilityId: responsibilityStatus.responsibilityId })
      .from(responsibilityStatus)
      .innerJoin(responsibility, eq(responsibilityStatus.responsibilityId, responsibility.id))
      .innerJoin(household, eq(responsibility.householdId, household.id))
      .where(
        and(
          eq(responsibilityStatus.userId, ownerUserId),
          eq(responsibilityStatus.status, "dismissed"),
          eq(household.ownerUserId, ownerUserId),
        ),
      ),
  ]);

  return {
    claimIds: claims.map(({ claimId }) => claimId),
    responsibilityIds: responsibilities.map(({ responsibilityId }) => responsibilityId),
  };
}

export async function setResponsibilityCompleted(
  ownerUserId: string,
  responsibilityId: string,
  completed: boolean,
) {
  const [ownedResponsibility] = await db
    .select({ id: responsibility.id })
    .from(responsibility)
    .innerJoin(household, eq(responsibility.householdId, household.id))
    .where(and(eq(responsibility.id, responsibilityId), eq(household.ownerUserId, ownerUserId)))
    .limit(1);
  if (!ownedResponsibility) throw new Error("Responsibility not found");

  await executeEvidenceStatusPlan(
    planEvidenceStatus({
      kind: "completion",
      ownerUserId,
      responsibilityId,
      completed,
    }),
  );
}

export async function setDemoResponsibilityCompleted(
  ownerUserId: string,
  responsibilityId: string,
  completed: boolean,
) {
  if (!(await isDemoResponsibilityId(responsibilityId))) {
    throw new Error("Unknown Demo Household Responsibility");
  }

  await executeEvidenceStatusPlan(
    planEvidenceStatus({
      kind: "completion",
      ownerUserId,
      responsibilityId,
      completed,
    }),
  );
}

export async function setEvidenceDismissed(
  ownerUserId: string,
  claimIds: string[],
  responsibilityIds: string[],
  dismissed: boolean,
) {
  const ownedClaims = await db
    .select({ id: claim.id })
    .from(claim)
    .innerJoin(schoolCommunication, eq(claim.communicationId, schoolCommunication.id))
    .innerJoin(household, eq(schoolCommunication.householdId, household.id))
    .where(and(inArray(claim.id, claimIds), eq(household.ownerUserId, ownerUserId)));
  if (ownedClaims.length !== claimIds.length) throw new Error("Digest item not found");

  if (responsibilityIds.length > 0) {
    const ownedResponsibilities = await db
      .select({ id: responsibility.id })
      .from(responsibility)
      .innerJoin(household, eq(responsibility.householdId, household.id))
      .where(
        and(inArray(responsibility.id, responsibilityIds), eq(household.ownerUserId, ownerUserId)),
      );
    if (ownedResponsibilities.length !== responsibilityIds.length) {
      throw new Error("Digest item not found");
    }
  }

  await executeEvidenceStatusPlan(
    planEvidenceStatus({
      kind: "dismissal",
      ownerUserId,
      claimIds,
      responsibilityIds,
      dismissed,
    }),
  );
}

async function executeEvidenceStatusPlan(plan: EvidenceStatusPlan) {
  await db.transaction(async (transaction) => {
    if (plan.claimStatus.deletes.length > 0) {
      await transaction.delete(claimStatus).where(
        and(
          eq(claimStatus.userId, plan.claimStatus.deletes[0]!.userId),
          inArray(
            claimStatus.claimId,
            plan.claimStatus.deletes.map(({ claimId }) => claimId),
          ),
        ),
      );
    }

    if (plan.responsibilityStatus.deletes.length > 0) {
      await transaction.delete(responsibilityStatus).where(
        and(
          eq(responsibilityStatus.userId, plan.responsibilityStatus.deletes[0]!.userId),
          inArray(
            responsibilityStatus.responsibilityId,
            plan.responsibilityStatus.deletes.map(({ responsibilityId }) => responsibilityId),
          ),
        ),
      );
    }

    if (plan.claimStatus.upserts.length > 0) {
      await transaction
        .insert(claimStatus)
        .values(plan.claimStatus.upserts)
        .onConflictDoUpdate({
          target: [claimStatus.userId, claimStatus.claimId],
          set: { status: "dismissed", updatedAt: new Date() },
        });
    }

    if (plan.responsibilityStatus.upserts.length > 0) {
      await transaction
        .insert(responsibilityStatus)
        .values(plan.responsibilityStatus.upserts)
        .onConflictDoUpdate({
          target: [responsibilityStatus.userId, responsibilityStatus.responsibilityId],
          set: {
            status: plan.responsibilityStatus.upserts[0]!.status,
            updatedAt: new Date(),
          },
        });
    }
  });
}
