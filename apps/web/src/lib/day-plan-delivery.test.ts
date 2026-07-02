import type { DayPlan } from "@repo/intelligence";
import { describe, expect, test } from "vite-plus/test";

import {
  deliverDayPlans,
  FakeDeliveryChannel,
  type DayPlanDeliveryRepository,
  type NewDayPlanDelivery,
} from "./day-plan-delivery";

describe("deliverDayPlans", () => {
  test("sends at most once per Household and plan date under a re-run", async () => {
    const channel = new FakeDeliveryChannel();
    const repository = new MemoryRepository();
    const candidate = deliveryCandidate("household-1");

    await deliverDayPlans([candidate], { channel, repository });
    await deliverDayPlans([candidate], { channel, repository });

    expect(channel.messages).toHaveLength(1);
    expect(repository.records.get("household-1:2026-07-03")?.status).toBe("sent");
  });

  test("retries a failed send without duplicating a successful send", async () => {
    const channel = new FakeDeliveryChannel();
    const repository = new MemoryRepository();
    const candidate = deliveryCandidate("household-1");
    channel.failNext(candidate.contact.phoneNumber);

    expect(await deliverDayPlans([candidate], { channel, repository })).toMatchObject([
      { outcome: "failed" },
    ]);
    expect(await deliverDayPlans([candidate], { channel, repository })).toMatchObject([
      { outcome: "sent" },
    ]);
    await deliverDayPlans([candidate], { channel, repository });

    expect(channel.messages).toHaveLength(1);
    expect(channel.attempts).toHaveLength(2);
  });

  test("records an empty plan as skipped and sends nothing", async () => {
    const channel = new FakeDeliveryChannel();
    const repository = new MemoryRepository();

    await deliverDayPlans([deliveryCandidate("household-1", emptyPlan())], {
      channel,
      repository,
    });

    expect(channel.messages).toHaveLength(0);
    expect(repository.records.get("household-1:2026-07-03")?.status).toBe("skipped");
  });

  test.each(["unverified", "opted_out"] as const)(
    "does not send to a %s Delivery Contact",
    async (consent) => {
      const channel = new FakeDeliveryChannel();
      const repository = new MemoryRepository();
      const candidate = {
        ...deliveryCandidate("household-1"),
        contact: { phoneNumber: "+447700900123", consent },
      };

      await deliverDayPlans([candidate], { channel, repository });

      expect(channel.messages).toHaveLength(0);
      expect(repository.records).toHaveProperty("size", 0);
    },
  );

  test("one Household's failure does not stop the sweep", async () => {
    const channel = new FakeDeliveryChannel();
    const repository = new MemoryRepository();
    channel.failNext("+447700900123");

    const outcomes = await deliverDayPlans(
      [deliveryCandidate("household-1"), deliveryCandidate("household-2", plan(), "+447700900124")],
      { channel, repository },
    );

    expect(outcomes.map(({ outcome }) => outcome)).toEqual(["failed", "sent"]);
    expect(channel.messages.map(({ to }) => to)).toEqual(["+447700900124"]);
  });
});

class MemoryRepository implements DayPlanDeliveryRepository {
  readonly records = new Map<
    string,
    NewDayPlanDelivery & { status: "sending" | "skipped" | "sent" | "failed"; messageId?: string }
  >();

  async claimForSend(delivery: NewDayPlanDelivery) {
    const key = `${delivery.householdId}:${delivery.planDate}`;
    const existing = this.records.get(key);
    if (existing && existing.status !== "failed") return false;
    this.records.set(key, { ...delivery, status: "sending" });
    return true;
  }

  async recordSkipped(delivery: NewDayPlanDelivery) {
    const key = `${delivery.householdId}:${delivery.planDate}`;
    if (!this.records.has(key)) this.records.set(key, { ...delivery, status: "skipped" });
  }

  async recordSent(householdId: string, planDate: string, messageId: string) {
    this.update(householdId, planDate, { status: "sent", messageId });
  }

  async recordFailed(householdId: string, planDate: string, error: string) {
    void error;
    this.update(householdId, planDate, { status: "failed" });
  }

  private update(
    householdId: string,
    planDate: string,
    update: { status: "sent" | "failed"; messageId?: string },
  ) {
    const key = `${householdId}:${planDate}`;
    const existing = this.records.get(key);
    if (!existing) throw new Error("Missing delivery record");
    this.records.set(key, { ...existing, ...update });
  }
}

function deliveryCandidate(householdId: string, dayPlan = plan(), phoneNumber = "+447700900123") {
  return {
    householdId,
    planDate: dayPlan.date,
    contact: { phoneNumber, consent: "opted_in" as const },
    dayPlan,
    deepLink: `https://comms.example/app?date=${dayPlan.date}`,
  };
}

function plan(): DayPlan {
  return {
    date: "2026-07-03",
    overdue: [],
    today: [
      { source: "responsibility", title: "Bring swimming kit", childIds: [], date: "2026-07-03" },
    ],
    noDate: [],
    comingUp: [],
  };
}

function emptyPlan(): DayPlan {
  return { date: "2026-07-03", overdue: [], today: [], noDate: [], comingUp: [] };
}
