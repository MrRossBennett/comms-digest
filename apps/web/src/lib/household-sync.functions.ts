import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { household } from "@repo/db/schema";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";

import { householdBackfillEvent, inngest } from "#/inngest/client";

import { getHouseholdSyncState } from "./household-sync.server";

// Returns the current sync state for the Household Owner's Household.
// Used by the UI to poll while status === 'running'.
export const $getHouseholdSyncState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const [householdRow] = await db
      .select({ id: household.id })
      .from(household)
      .where(eq(household.ownerUserId, context.user.id))
      .limit(1);
    if (!householdRow) return null;
    return getHouseholdSyncState(householdRow.id);
  });

// Trigger a first-connect backfill via Inngest.
// Called after Gmail is connected during onboarding.
export const $triggerBackfill = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const [householdRow] = await db
      .select({ id: household.id })
      .from(household)
      .where(eq(household.ownerUserId, context.user.id))
      .limit(1);
    if (!householdRow) throw new Error("Household not found");

    await inngest.send(
      householdBackfillEvent.create({ householdId: householdRow.id, ownerUserId: context.user.id }),
    );

    return { queued: true };
  });
