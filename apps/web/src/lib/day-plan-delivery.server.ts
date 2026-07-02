import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import { dayPlanDelivery, deliveryContact as deliveryContactTable } from "@repo/db/schema";
import { todayInTimezone, type DayPlan } from "@repo/intelligence";
import { and, eq, sql } from "drizzle-orm";

import {
  deliverDayPlans,
  type DayPlanDeliveryRepository,
  type NewDayPlanDelivery,
} from "./day-plan-delivery";
import type { DeliveryContact } from "./delivery-contact";
import { canDeliverTo } from "./delivery-contact";
import { getDayPlanForOwner } from "./household-day-plan.server";
import { getSmsDeliveryChannel } from "./twilio-sms.server";

const HOUSEHOLD_TIMEZONE = "Europe/London";

export async function deliverTomorrowForOwner(
  householdId: string,
  ownerUserId: string,
  now = new Date(),
) {
  const planDate = addDays(todayInTimezone(HOUSEHOLD_TIMEZONE, now), 1);
  return deliverDayPlanForOwner(householdId, ownerUserId, planDate);
}

export async function deliverDayPlanForOwner(
  householdId: string,
  ownerUserId: string,
  planDate: string,
) {
  const planData = await getDayPlanForOwner(ownerUserId, planDate);
  if (!planData || planData.household.id !== householdId) throw new Error("Household not found");
  const [[contactRow], [existingDelivery]] = await Promise.all([
    db
      .select()
      .from(deliveryContactTable)
      .where(eq(deliveryContactTable.householdId, householdId))
      .limit(1),
    db
      .select({ status: dayPlanDelivery.status, planSnapshot: dayPlanDelivery.planSnapshot })
      .from(dayPlanDelivery)
      .where(
        and(eq(dayPlanDelivery.householdId, householdId), eq(dayPlanDelivery.planDate, planDate)),
      )
      .limit(1),
  ]);
  const contact = contactRow ? contactFromRow(contactRow) : null;
  if (!canDeliverTo(contact)) {
    return [{ householdId, planDate, outcome: "ineligible" as const }];
  }
  const baseUrl = (
    process.env.APP_BASE_URL ??
    process.env.VITE_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");

  return deliverDayPlans(
    [
      {
        householdId,
        planDate,
        contact,
        dayPlan:
          existingDelivery?.status === "failed"
            ? (existingDelivery.planSnapshot as DayPlan)
            : planData.dayPlan,
        deepLink: `${baseUrl}/app?date=${planDate}`,
      },
    ],
    {
      channel: getSmsDeliveryChannel(),
      repository: databaseDeliveryRepository,
      statusCallbackUrl: `${baseUrl}/api/twilio`,
    },
  );
}

export async function updateDeliveryStatus(providerMessageId: string, providerStatus: string) {
  if (providerStatus === "delivered") {
    await db
      .update(dayPlanDelivery)
      .set({ status: "delivered", deliveredAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(dayPlanDelivery.providerMessageId, providerMessageId));
    return;
  }
  if (["failed", "undelivered"].includes(providerStatus)) {
    const [failed] = await db
      .update(dayPlanDelivery)
      .set({
        status: "failed",
        lastError: `Twilio status: ${providerStatus}`,
        updatedAt: new Date(),
      })
      .where(eq(dayPlanDelivery.providerMessageId, providerMessageId))
      .returning({
        householdId: dayPlanDelivery.householdId,
        planDate: dayPlanDelivery.planDate,
        attemptCount: dayPlanDelivery.attemptCount,
      });
    if (failed && failed.attemptCount < 3) return failed;
  }
}

const databaseDeliveryRepository: DayPlanDeliveryRepository = {
  async claimForSend(delivery) {
    return db.transaction(async (transaction) => {
      const inserted = await transaction
        .insert(dayPlanDelivery)
        .values({ ...insertValues(delivery), status: "attempting" })
        .onConflictDoNothing({
          target: [dayPlanDelivery.householdId, dayPlanDelivery.planDate],
        })
        .returning({ id: dayPlanDelivery.id });
      if (inserted.length > 0) return true;

      const reclaimed = await transaction
        .update(dayPlanDelivery)
        .set({
          planSnapshot: delivery.dayPlan,
          messageText: delivery.messageText,
          status: "attempting",
          attemptCount: sql`${dayPlanDelivery.attemptCount} + 1`,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(dayPlanDelivery.householdId, delivery.householdId),
            eq(dayPlanDelivery.planDate, delivery.planDate),
            eq(dayPlanDelivery.status, "failed"),
          ),
        )
        .returning({ id: dayPlanDelivery.id });
      return reclaimed.length > 0;
    });
  },

  async recordSkipped(delivery) {
    await db
      .insert(dayPlanDelivery)
      .values({ ...insertValues(delivery), status: "skipped" })
      .onConflictDoNothing({ target: [dayPlanDelivery.householdId, dayPlanDelivery.planDate] });
  },

  async recordSent(householdId, planDate, messageId) {
    await db
      .update(dayPlanDelivery)
      .set({
        status: "sent",
        providerMessageId: messageId,
        sentAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(dayPlanDelivery.householdId, householdId), eq(dayPlanDelivery.planDate, planDate)),
      );
  },

  async recordFailed(householdId, planDate, error) {
    await db
      .update(dayPlanDelivery)
      .set({ status: "failed", lastError: error, updatedAt: new Date() })
      .where(
        and(eq(dayPlanDelivery.householdId, householdId), eq(dayPlanDelivery.planDate, planDate)),
      );
  },
};

function insertValues(delivery: NewDayPlanDelivery) {
  return {
    id: crypto.randomUUID(),
    householdId: delivery.householdId,
    planDate: delivery.planDate,
    planSnapshot: delivery.dayPlan,
    messageText: delivery.messageText,
    attemptCount: 1,
  };
}

function contactFromRow(row: typeof deliveryContactTable.$inferSelect): DeliveryContact {
  return { phoneNumber: row.phoneNumber, consent: row.consent };
}

function addDays(date: string, days: number) {
  const instant = new Date(`${date}T00:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}
