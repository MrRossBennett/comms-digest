import "@tanstack/react-start/server-only";
import { createHmac, randomInt } from "node:crypto";

import { db } from "@repo/db";
import { dayPlanDelivery, deliveryContact as deliveryContactTable } from "@repo/db/schema";
import type { DayPlan } from "@repo/intelligence";
import { desc, eq } from "drizzle-orm";

import { type DeliveryContact, transitionDeliveryContact } from "./delivery-contact";
import { getHouseholdForOwner } from "./household.server";
import { getSmsDeliveryChannel } from "./twilio-sms.server";

const VERIFICATION_LIFETIME_MS = 5 * 60_000;
const VERIFICATION_ATTEMPTS = 3;

export async function getDeliverySettingsForOwner(ownerUserId: string) {
  const household = await getHouseholdForOwner(ownerUserId);
  if (!household) return null;
  const [contact] = await db
    .select()
    .from(deliveryContactTable)
    .where(eq(deliveryContactTable.householdId, household.id))
    .limit(1);
  const deliveries = await db
    .select({
      planDate: dayPlanDelivery.planDate,
      planSnapshot: dayPlanDelivery.planSnapshot,
      messageText: dayPlanDelivery.messageText,
      status: dayPlanDelivery.status,
      lastError: dayPlanDelivery.lastError,
      sentAt: dayPlanDelivery.sentAt,
    })
    .from(dayPlanDelivery)
    .where(eq(dayPlanDelivery.householdId, household.id))
    .orderBy(desc(dayPlanDelivery.planDate))
    .limit(7);

  return {
    contact: contact ? { phoneNumber: contact.phoneNumber, consent: contact.consent } : null,
    deliveries: deliveries.map((delivery) => ({
      ...delivery,
      planSnapshot: delivery.planSnapshot as DayPlan,
    })),
  };
}

export async function replaceDeliveryContactForOwner(ownerUserId: string, phoneNumber: string) {
  const household = await requireHousehold(ownerUserId);
  const challenge = createChallenge();
  const transition = transitionDeliveryContact(null, {
    type: "replace_number",
    phoneNumber,
    ...challenge,
  });
  const row = toRow(household.id, transition.contact);
  const { id: _id, ...update } = row;
  await db
    .insert(deliveryContactTable)
    .values(row)
    .onConflictDoUpdate({
      target: deliveryContactTable.householdId,
      set: { ...update, updatedAt: new Date() },
    });
  await sendVerificationCode(transition.contact.phoneNumber, challenge.code);
  return { phoneNumber: transition.contact.phoneNumber, consent: transition.contact.consent };
}

export async function requestDeliveryContactCodeForOwner(ownerUserId: string) {
  const { row, contact } = await requireContact(ownerUserId);
  const challenge = createChallenge();
  const transition = transitionDeliveryContact(contact, { type: "request_code", ...challenge });
  if (transition.outcome === "rejected") throw new Error(transition.reason);
  await persistContact(row.id, transition.contact);
  await sendVerificationCode(transition.contact.phoneNumber, challenge.code);
  return { phoneNumber: transition.contact.phoneNumber, consent: transition.contact.consent };
}

export async function verifyDeliveryContactForOwner(ownerUserId: string, code: string) {
  const { row, contact } = await requireContact(ownerUserId);
  const transition = transitionDeliveryContact(contact, {
    type: "verify",
    codeHash: hashCode(code),
    now: new Date(),
  });
  await persistContact(row.id, transition.contact);
  if (transition.outcome === "rejected") throw new Error(transition.reason);
  return { phoneNumber: transition.contact.phoneNumber, consent: transition.contact.consent };
}

export async function setDeliveryConsentForOwner(ownerUserId: string, optedIn: boolean) {
  const { row, contact } = await requireContact(ownerUserId);
  const transition = transitionDeliveryContact(contact, { type: optedIn ? "opt_in" : "opt_out" });
  if (transition.outcome === "rejected") throw new Error(transition.reason);
  await persistContact(row.id, transition.contact);
  return { phoneNumber: transition.contact.phoneNumber, consent: transition.contact.consent };
}

export async function deleteDeliveryContactForOwner(ownerUserId: string) {
  const household = await requireHousehold(ownerUserId);
  await db.delete(deliveryContactTable).where(eq(deliveryContactTable.householdId, household.id));
}

export async function reconcileInboundConsent(phoneNumber: string, keyword: "stop" | "start") {
  const [row] = await db
    .select()
    .from(deliveryContactTable)
    .where(eq(deliveryContactTable.phoneNumber, phoneNumber))
    .limit(1);
  if (!row) return false;
  const transition = transitionDeliveryContact(fromRow(row), { type: keyword });
  if (transition.outcome === "changed") await persistContact(row.id, transition.contact);
  return true;
}

async function requireHousehold(ownerUserId: string) {
  const household = await getHouseholdForOwner(ownerUserId);
  if (!household) throw new Error("Complete Household setup before adding a Delivery Contact");
  return household;
}

async function requireContact(ownerUserId: string) {
  const household = await requireHousehold(ownerUserId);
  const [row] = await db
    .select()
    .from(deliveryContactTable)
    .where(eq(deliveryContactTable.householdId, household.id))
    .limit(1);
  if (!row) throw new Error("Delivery Contact does not exist");
  return { row, contact: fromRow(row) };
}

function fromRow(row: typeof deliveryContactTable.$inferSelect): DeliveryContact {
  const verification =
    row.verificationCodeHash &&
    row.verificationExpiresAt &&
    row.verificationAttemptsRemaining !== null &&
    row.verificationRequestedAt
      ? {
          codeHash: row.verificationCodeHash,
          expiresAt: row.verificationExpiresAt,
          attemptsRemaining: row.verificationAttemptsRemaining,
          requestedAt: row.verificationRequestedAt,
        }
      : undefined;
  return { phoneNumber: row.phoneNumber, consent: row.consent, verification };
}

function toRow(householdId: string, contact: DeliveryContact) {
  return {
    id: crypto.randomUUID(),
    householdId,
    phoneNumber: contact.phoneNumber,
    consent: contact.consent,
    verificationCodeHash: contact.verification?.codeHash ?? null,
    verificationExpiresAt: contact.verification?.expiresAt ?? null,
    verificationAttemptsRemaining: contact.verification?.attemptsRemaining ?? null,
    verificationRequestedAt: contact.verification?.requestedAt ?? null,
  };
}

async function persistContact(id: string, contact: DeliveryContact) {
  const values = toRow("unused", contact);
  await db
    .update(deliveryContactTable)
    .set({
      phoneNumber: values.phoneNumber,
      consent: values.consent,
      verificationCodeHash: values.verificationCodeHash,
      verificationExpiresAt: values.verificationExpiresAt,
      verificationAttemptsRemaining: values.verificationAttemptsRemaining,
      verificationRequestedAt: values.verificationRequestedAt,
      updatedAt: new Date(),
    })
    .where(eq(deliveryContactTable.id, id));
}

function createChallenge() {
  const now = new Date();
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return {
    code,
    codeHash: hashCode(code),
    now,
    expiresAt: new Date(now.getTime() + VERIFICATION_LIFETIME_MS),
    attempts: VERIFICATION_ATTEMPTS,
  };
}

function hashCode(code: string) {
  const secret = process.env.BETTER_AUTH_SECRET ?? "comms-digest-local-verification";
  return createHmac("sha256", secret).update(code).digest("hex");
}

async function sendVerificationCode(phoneNumber: string, code: string) {
  await getSmsDeliveryChannel().send({
    to: phoneNumber,
    body: `Comms Digest verification code: ${code}`,
  });
}
