import { Inngest, eventType, staticSchema } from "inngest";

export const householdSyncEvent = eventType("household/sync", {
  schema: staticSchema<{ householdId: string; ownerUserId: string }>(),
});

export const householdBackfillEvent = eventType("household/backfill", {
  schema: staticSchema<{ householdId: string; ownerUserId: string }>(),
});

export const inngest = new Inngest({ id: "comms-digest" });
