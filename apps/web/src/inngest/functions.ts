import { db } from "@repo/db";
import { household, syncRun } from "@repo/db/schema";
import { eq } from "drizzle-orm";

import { deliverDayPlanForOwner, deliverTomorrowForOwner } from "#/lib/day-plan-delivery.server";
import { fetchAndIngestForHousehold } from "#/lib/household-digest.server";
import { markHouseholdSyncIdle, tryMarkHouseholdSyncRunning } from "#/lib/household-sync.server";
import { isRootCauseReauth } from "#/lib/sync-error";

import {
  dayPlanDeliveryRetryEvent,
  householdBackfillEvent,
  householdSyncEvent,
  inngest,
} from "./client";

// Deliberately high anomaly threshold — a smoke alarm, not a budget cap.
// See: docs/adr/0011 Deliberately Deferred — enforced spend cap.
const ANOMALY_MESSAGES = 500;
const ANOMALY_INPUT_TOKENS = 5_000_000;

// ─── Per-Household sync ────────────────────────────────────────────────────────
// concurrencyKey prevents two Inngest runs for the same Household running at once.
// tryMarkHouseholdSyncRunning handles the race between this and a manual refresh.
export const syncHouseholdFn = inngest.createFunction(
  {
    id: "sync-household",
    triggers: [{ event: householdSyncEvent }],
    concurrency: { key: "event.data.householdId", limit: 1 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { householdId, ownerUserId, deliverTomorrow } = event.data;

    const acquired = await step.run("acquire-slot", () => tryMarkHouseholdSyncRunning(householdId));

    // Manual refresh got here first — cron loses this round (within freshness budget).
    if (!acquired) {
      if (deliverTomorrow) throw new Error("Evening sync collided with another Household sync");
      return { outcome: "skipped_locked" as const };
    }

    let result: { messagesExtracted: number; inputTokens: number; outputTokens: number };
    try {
      result = await step.run("fetch-and-ingest", () =>
        fetchAndIngestForHousehold(householdId, ownerUserId, { paginate: false }),
      );

      await step.run("mark-idle", () =>
        markHouseholdSyncIdle(householdId, { success: true, ...result }),
      );
    } catch (error) {
      await step.run("mark-idle-on-error", () =>
        markHouseholdSyncIdle(householdId, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          needsReauth: isRootCauseReauth(error),
        }),
      );
      throw error; // re-throw so Inngest retries
    }

    if (deliverTomorrow) {
      await step.run("compose-and-deliver-tomorrow", async () => {
        const delivery = await deliverTomorrowForOwner(householdId, ownerUserId);
        if (delivery.some(({ outcome }) => outcome === "failed")) {
          throw new Error("Day Plan SMS delivery failed");
        }
        return delivery;
      });
    }

    return { outcome: "completed" as const, ...result };
  },
);

// ─── Scheduled sweep ──────────────────────────────────────────────────────────
// Three sweeps per day, not evenly spaced:
// - 07:00 UTC (morning keep-warm)
// - 12:30 UTC (midday keep-warm)
// - 17:30 UTC (evening — positioned for Slice 3's sync-then-compose trigger)
export const scheduledSweepFn = inngest.createFunction(
  {
    id: "scheduled-sweep",
    triggers: [{ cron: "0 7 * * *" }, { cron: "30 12 * * *" }],
  },
  async ({ step }) => {
    const startedAt = new Date();
    const runId = crypto.randomUUID();

    const households = await step.run("list-households", () =>
      db.select({ id: household.id, ownerUserId: household.ownerUserId }).from(household),
    );

    // Fan-out: one household/sync event per Household.
    // Inngest's concurrencyKey on syncHouseholdFn ensures at most one run per Household.
    await step.sendEvent(
      "fan-out-sync-events",
      households.map(({ id, ownerUserId }) =>
        householdSyncEvent.create({ householdId: id, ownerUserId }),
      ),
    );

    // Record the sweep. Individual outcomes land in household_sync rows.
    await step.run("record-sweep-run", () =>
      db.insert(syncRun).values({
        id: runId,
        startedAt,
        finishedAt: new Date(),
        householdsProcessed: households.length,
        messagesExtracted: 0,
        inputTokens: 0,
        outputTokens: 0,
        failureCount: 0,
        isBackfill: false,
        anomaly: false,
      }),
    );

    return { householdsQueued: households.length, runId };
  },
);

// The evening sweep is separate so every per-Household workflow can compose and
// deliver only after its own sync has completed successfully.
export const eveningSweepFn = inngest.createFunction(
  {
    id: "evening-sweep",
    triggers: [{ cron: "30 17 * * *" }],
  },
  async ({ step }) => {
    const startedAt = new Date();
    const runId = crypto.randomUUID();
    const households = await step.run("list-households", () =>
      db.select({ id: household.id, ownerUserId: household.ownerUserId }).from(household),
    );
    await step.sendEvent(
      "fan-out-evening-sync-events",
      households.map(({ id, ownerUserId }) =>
        householdSyncEvent.create({ householdId: id, ownerUserId, deliverTomorrow: true }),
      ),
    );
    await step.run("record-sweep-run", () =>
      db.insert(syncRun).values({
        id: runId,
        startedAt,
        finishedAt: new Date(),
        householdsProcessed: households.length,
        messagesExtracted: 0,
        inputTokens: 0,
        outputTokens: 0,
        failureCount: 0,
        isBackfill: false,
        anomaly: false,
      }),
    );
    return { householdsQueued: households.length, runId };
  },
);

export const retryDayPlanDeliveryFn = inngest.createFunction(
  {
    id: "retry-day-plan-delivery",
    triggers: [{ event: dayPlanDeliveryRetryEvent }],
    concurrency: { key: "event.data.householdId", limit: 1 },
    retries: 2,
  },
  async ({ event, step }) => {
    const [householdRow] = await step.run("load-household-owner", () =>
      db
        .select({ ownerUserId: household.ownerUserId })
        .from(household)
        .where(eq(household.id, event.data.householdId))
        .limit(1),
    );
    if (!householdRow) return { outcome: "household_missing" as const };

    return step.run("retry-delivery", async () => {
      const delivery = await deliverDayPlanForOwner(
        event.data.householdId,
        householdRow.ownerUserId,
        event.data.planDate,
      );
      if (delivery.some(({ outcome }) => outcome === "failed")) {
        throw new Error("Day Plan SMS delivery retry failed");
      }
      return delivery;
    });
  },
);

// ─── First-connect backfill ───────────────────────────────────────────────────
// Triggered when a Household connects Gmail. Paginates within the 30d window.
// Accounted on its own sync_run line (isBackfill=true), exempt from steady-state cap.
export const backfillHouseholdFn = inngest.createFunction(
  {
    id: "backfill-household",
    triggers: [{ event: householdBackfillEvent }],
    concurrency: { key: "event.data.householdId", limit: 1 },
    retries: 1,
  },
  async ({ event, step }) => {
    const { householdId, ownerUserId } = event.data;
    const startedAt = new Date();
    const runId = crypto.randomUUID();

    const acquired = await step.run("acquire-slot", () => tryMarkHouseholdSyncRunning(householdId));

    // Manual refresh won the race at t=0 — backfill will not double-scan.
    if (!acquired) return { outcome: "skipped_locked" as const };

    const result = await step.run("fetch-and-ingest-paginated", () =>
      fetchAndIngestForHousehold(householdId, ownerUserId, { paginate: true }),
    );

    await step.run("mark-idle", () =>
      markHouseholdSyncIdle(householdId, { success: true, ...result }),
    );

    const anomaly =
      result.messagesExtracted > ANOMALY_MESSAGES || result.inputTokens > ANOMALY_INPUT_TOKENS;

    if (anomaly) {
      console.error("[backfill:anomaly] Backfill exceeded anomaly threshold", {
        householdId,
        runId,
        ...result,
      });
    }

    await step.run("record-backfill-run", () =>
      db.insert(syncRun).values({
        id: runId,
        startedAt,
        finishedAt: new Date(),
        householdsProcessed: 1,
        messagesExtracted: result.messagesExtracted,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        failureCount: 0,
        isBackfill: true,
        anomaly,
      }),
    );

    return { outcome: "completed" as const, ...result };
  },
);

export const allFunctions = [
  syncHouseholdFn,
  scheduledSweepFn,
  eveningSweepFn,
  retryDayPlanDeliveryFn,
  backfillHouseholdFn,
];
