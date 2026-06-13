import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import { responsibilityStatus } from "@repo/db/schema";
import { and, eq } from "drizzle-orm";

export async function listCompletedResponsibilityIds(userId: string) {
  const rows = await db
    .select({ responsibilityId: responsibilityStatus.responsibilityId })
    .from(responsibilityStatus)
    .where(
      and(eq(responsibilityStatus.userId, userId), eq(responsibilityStatus.status, "completed")),
    );

  return rows.map(({ responsibilityId }) => responsibilityId);
}

export async function setResponsibilityCompleted(
  userId: string,
  responsibilityId: string,
  completed: boolean,
) {
  if (!completed) {
    await db
      .delete(responsibilityStatus)
      .where(
        and(
          eq(responsibilityStatus.userId, userId),
          eq(responsibilityStatus.responsibilityId, responsibilityId),
        ),
      );
    return;
  }

  await db
    .insert(responsibilityStatus)
    .values({
      userId,
      responsibilityId,
      status: "completed",
    })
    .onConflictDoUpdate({
      target: [responsibilityStatus.userId, responsibilityStatus.responsibilityId],
      set: {
        status: "completed",
        updatedAt: new Date(),
      },
    });
}
