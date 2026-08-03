import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import { householdSync } from "@repo/db/schema";
import { eq, sql } from "drizzle-orm";

import { getErrorMessage } from "./error-message";
import { getHouseholdDigestForOwner } from "./household-digest.server";
import { fetchAndIngestForHousehold } from "./household-ingestion.server";
import { getHouseholdForOwner } from "./household.server";
import { isRootCauseReauth } from "./sync-error";

export type SyncOutcome =
  | { success: true; messagesExtracted: number; inputTokens: number; outputTokens: number }
  | { success: false; error: string; needsReauth: boolean };

export async function fetchNewCommunicationsForOwner(ownerUserId: string): Promise<
  | {
      importedCount: number;
      syncing: false;
      digest: Awaited<ReturnType<typeof getHouseholdDigestForOwner>>;
    }
  | { syncing: true }
> {
  const householdSetup = await getHouseholdForOwner(ownerUserId);
  if (!householdSetup) throw new Error("Complete Household setup before fetching communications");

  const acquired = await tryMarkHouseholdSyncRunning(householdSetup.id);
  if (!acquired) return { syncing: true };

  try {
    const result = await fetchAndIngestForHousehold(householdSetup.id, ownerUserId, {
      paginate: false,
    });
    await markHouseholdSyncIdle(householdSetup.id, { success: true, ...result });
    return {
      syncing: false,
      importedCount: result.messagesExtracted,
      digest: await getHouseholdDigestForOwner(ownerUserId),
    };
  } catch (error) {
    await markHouseholdSyncIdle(householdSetup.id, {
      success: false,
      error: getErrorMessage(error, "Sync failed"),
      needsReauth: isRootCauseReauth(error),
    });
    throw error;
  }
}

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
