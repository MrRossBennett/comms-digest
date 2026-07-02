import { composeDayPlanMessage, type DayPlan } from "@repo/intelligence";

import { canDeliverTo, type DeliveryContact } from "./delivery-contact";

export type DeliveryMessage = { to: string; body: string; statusCallbackUrl?: string };

export interface DeliveryChannel {
  send(message: DeliveryMessage): Promise<{ messageId: string }>;
}

export type DayPlanDeliveryCandidate = {
  householdId: string;
  planDate: string;
  contact: DeliveryContact | null;
  dayPlan: DayPlan;
  deepLink: string;
};

export type NewDayPlanDelivery = {
  householdId: string;
  planDate: string;
  dayPlan: DayPlan;
  messageText: string | null;
};

export interface DayPlanDeliveryRepository {
  claimForSend(delivery: NewDayPlanDelivery): Promise<boolean>;
  recordSkipped(delivery: NewDayPlanDelivery): Promise<void>;
  recordSent(householdId: string, planDate: string, messageId: string): Promise<void>;
  recordFailed(householdId: string, planDate: string, error: string): Promise<void>;
}

export async function deliverDayPlans(
  candidates: DayPlanDeliveryCandidate[],
  dependencies: {
    channel: DeliveryChannel;
    repository: DayPlanDeliveryRepository;
    statusCallbackUrl?: string;
  },
) {
  const outcomes: Array<{
    householdId: string;
    planDate: string;
    outcome: "ineligible" | "skipped_empty" | "already_processed" | "sent" | "failed";
  }> = [];

  for (const candidate of candidates) {
    if (!canDeliverTo(candidate.contact)) {
      outcomes.push({ ...keyOf(candidate), outcome: "ineligible" });
      continue;
    }

    const composed = composeDayPlanMessage(candidate.dayPlan, candidate.deepLink);
    if (composed.outcome === "skipped_empty") {
      await dependencies.repository.recordSkipped({
        ...keyOf(candidate),
        dayPlan: candidate.dayPlan,
        messageText: null,
      });
      outcomes.push({ ...keyOf(candidate), outcome: "skipped_empty" });
      continue;
    }

    const claimed = await dependencies.repository.claimForSend({
      ...keyOf(candidate),
      dayPlan: candidate.dayPlan,
      messageText: composed.body,
    });
    if (!claimed) {
      outcomes.push({ ...keyOf(candidate), outcome: "already_processed" });
      continue;
    }

    try {
      const sent = await dependencies.channel.send({
        to: candidate.contact.phoneNumber,
        body: composed.body,
        statusCallbackUrl: dependencies.statusCallbackUrl,
      });
      await dependencies.repository.recordSent(
        candidate.householdId,
        candidate.planDate,
        sent.messageId,
      );
      outcomes.push({ ...keyOf(candidate), outcome: "sent" });
    } catch (error) {
      await dependencies.repository.recordFailed(
        candidate.householdId,
        candidate.planDate,
        error instanceof Error ? error.message : String(error),
      );
      outcomes.push({ ...keyOf(candidate), outcome: "failed" });
    }
  }

  return outcomes;
}

export class FakeDeliveryChannel implements DeliveryChannel {
  readonly messages: Array<DeliveryMessage & { messageId: string }> = [];
  readonly attempts: DeliveryMessage[] = [];
  private readonly failuresRemaining = new Map<string, number>();

  failNext(to: string, count = 1) {
    this.failuresRemaining.set(to, count);
  }

  async send(message: DeliveryMessage) {
    this.attempts.push(message);
    const failures = this.failuresRemaining.get(message.to) ?? 0;
    if (failures > 0) {
      this.failuresRemaining.set(message.to, failures - 1);
      throw new Error("Fake channel send failed");
    }
    const messageId = `fake-${this.messages.length + 1}`;
    this.messages.push({ ...message, messageId });
    return { messageId };
  }
}

function keyOf(candidate: DayPlanDeliveryCandidate) {
  return { householdId: candidate.householdId, planDate: candidate.planDate };
}
