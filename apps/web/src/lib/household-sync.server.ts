import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import { householdSync } from "@repo/db/schema";
import { eq, sql } from "drizzle-orm";

export type SyncOutcome =
  | { success: true; messagesExtracted: number; inputTokens: number; outputTokens: number }
  | { success: false; error: string; needsReauth: boolean };

// Atomically flip status idle→running. Returns true if this caller acquired the slot.
// Used by both manual refresh and Inngest functions to prevent double-scans.
export async function tryMarkHouseholdSyncRunning(householdId: string): Promise<boolean> {
  await db
    .insert(householdSync)
    .values({ householdId, status: "idle", updatedAt: new Date() })
    .onConflictDoNothing({ target: householdSync.householdId });

  const rows = await db
    .update(householdSync)
    .set({ status: "running", updatedAt: new Date() })
    .where(
      sql`${householdSync.householdId} = ${householdId} AND ${householdSync.status} = 'idle'::household_sync_status`,
    )
    .returning({ householdId: householdSync.householdId });

  return rows.length > 0;
}

export async function markHouseholdSyncIdle(
  householdId: string,
  outcome: SyncOutcome,
): Promise<void> {
  const now = new Date();
  if (outcome.success) {
    await db
      .update(householdSync)
      .set({
        status: "idle",
        lastSyncedAt: now,
        lastSyncMessageCount: outcome.messagesExtracted,
        lastSyncInputTokens: outcome.inputTokens,
        lastSyncOutputTokens: outcome.outputTokens,
        lastError: null,
        needsReauth: false,
        updatedAt: now,
      })
      .where(eq(householdSync.householdId, householdId));
  } else {
    await db
      .update(householdSync)
      .set({
        status: "idle",
        lastError: outcome.error,
        needsReauth: outcome.needsReauth,
        updatedAt: now,
      })
      .where(eq(householdSync.householdId, householdId));
  }
}

export async function getHouseholdSyncState(householdId: string) {
  const [row] = await db
    .select({
      status: householdSync.status,
      lastSyncedAt: householdSync.lastSyncedAt,
      needsReauth: householdSync.needsReauth,
      lastError: householdSync.lastError,
    })
    .from(householdSync)
    .where(eq(householdSync.householdId, householdId))
    .limit(1);

  return row ?? null;
}
