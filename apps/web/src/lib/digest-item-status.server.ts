import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import { claimStatus, responsibilityStatus } from "@repo/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function listDismissedDigestEvidenceIds(userId: string) {
  const [claims, responsibilities] = await Promise.all([
    db
      .select({ claimId: claimStatus.claimId })
      .from(claimStatus)
      .where(and(eq(claimStatus.userId, userId), eq(claimStatus.status, "dismissed"))),
    db
      .select({ responsibilityId: responsibilityStatus.responsibilityId })
      .from(responsibilityStatus)
      .where(
        and(eq(responsibilityStatus.userId, userId), eq(responsibilityStatus.status, "dismissed")),
      ),
  ]);

  return {
    claimIds: claims.map(({ claimId }) => claimId),
    responsibilityIds: responsibilities.map(({ responsibilityId }) => responsibilityId),
  };
}

export async function setDigestEvidenceDismissed(
  userId: string,
  claimIds: string[],
  responsibilityIds: string[],
  dismissed: boolean,
) {
  await db.transaction(async (transaction) => {
    if (!dismissed) {
      await transaction
        .delete(claimStatus)
        .where(and(eq(claimStatus.userId, userId), inArray(claimStatus.claimId, claimIds)));
      if (responsibilityIds.length > 0) {
        await transaction
          .delete(responsibilityStatus)
          .where(
            and(
              eq(responsibilityStatus.userId, userId),
              inArray(responsibilityStatus.responsibilityId, responsibilityIds),
            ),
          );
      }
      return;
    }

    await transaction
      .insert(claimStatus)
      .values(claimIds.map((claimId) => ({ userId, claimId, status: "dismissed" as const })))
      .onConflictDoUpdate({
        target: [claimStatus.userId, claimStatus.claimId],
        set: { status: "dismissed", updatedAt: new Date() },
      });

    if (responsibilityIds.length > 0) {
      await transaction
        .insert(responsibilityStatus)
        .values(
          responsibilityIds.map((responsibilityId) => ({
            userId,
            responsibilityId,
            status: "dismissed" as const,
          })),
        )
        .onConflictDoUpdate({
          target: [responsibilityStatus.userId, responsibilityStatus.responsibilityId],
          set: { status: "dismissed", updatedAt: new Date() },
        });
    }
  });
}
