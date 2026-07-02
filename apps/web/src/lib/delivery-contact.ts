import { z } from "zod";

export const e164PhoneNumberSchema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Enter a mobile number in international format, for example +447700900123",
  );

export type DeliveryContact = {
  phoneNumber: string;
  consent: "unverified" | "opted_in" | "opted_out";
  verification?: {
    codeHash: string;
    expiresAt: Date;
    attemptsRemaining: number;
    requestedAt: Date;
  };
};

export type DeliveryContactEvent =
  | {
      type: "replace_number";
      phoneNumber: string;
      codeHash: string;
      now: Date;
      expiresAt: Date;
      attempts: number;
    }
  | { type: "request_code"; codeHash: string; now: Date; expiresAt: Date; attempts: number }
  | { type: "verify"; codeHash: string; now: Date }
  | { type: "opt_out" | "stop" }
  | { type: "opt_in" | "start" };

export type DeliveryContactTransition =
  | { outcome: "changed"; contact: DeliveryContact }
  | {
      outcome: "rejected";
      reason:
        | "invalid_transition"
        | "code_expired"
        | "code_incorrect"
        | "code_exhausted"
        | "code_throttled";
      contact: DeliveryContact;
    };

const REQUEST_THROTTLE_MS = 60_000;

export function transitionDeliveryContact(
  contact: DeliveryContact | null,
  event: DeliveryContactEvent,
): DeliveryContactTransition {
  if (event.type === "replace_number") {
    return {
      outcome: "changed",
      contact: {
        phoneNumber: e164PhoneNumberSchema.parse(event.phoneNumber),
        consent: "unverified",
        verification: challengeFrom(event),
      },
    };
  }
  if (!contact) throw new Error("Delivery Contact does not exist");

  if (event.type === "request_code") {
    if (contact.consent !== "unverified" || !contact.verification) {
      return rejected(contact, "invalid_transition");
    }
    if (event.now.getTime() - contact.verification.requestedAt.getTime() < REQUEST_THROTTLE_MS) {
      return rejected(contact, "code_throttled");
    }
    return {
      outcome: "changed",
      contact: { ...contact, verification: challengeFrom(event) },
    };
  }

  if (event.type === "verify") {
    if (contact.consent !== "unverified" || !contact.verification) {
      return rejected(contact, "invalid_transition");
    }
    if (contact.verification.attemptsRemaining <= 0) {
      return rejected(contact, "code_exhausted");
    }
    if (event.now >= contact.verification.expiresAt) {
      return rejected(contact, "code_expired");
    }
    if (event.codeHash !== contact.verification.codeHash) {
      const attemptsRemaining = contact.verification.attemptsRemaining - 1;
      return {
        outcome: "rejected",
        reason: attemptsRemaining === 0 ? "code_exhausted" : "code_incorrect",
        contact: {
          ...contact,
          verification: { ...contact.verification, attemptsRemaining },
        },
      };
    }
    return {
      outcome: "changed",
      contact: { phoneNumber: contact.phoneNumber, consent: "opted_in" },
    };
  }

  if (event.type === "opt_out" || event.type === "stop") {
    if (contact.consent !== "opted_in") return rejected(contact, "invalid_transition");
    return { outcome: "changed", contact: { ...contact, consent: "opted_out" } };
  }

  if (contact.consent !== "opted_out") return rejected(contact, "invalid_transition");
  return { outcome: "changed", contact: { ...contact, consent: "opted_in" } };
}

export function canDeliverTo(
  contact: DeliveryContact | null,
): contact is DeliveryContact & { consent: "opted_in" } {
  return contact?.consent === "opted_in";
}

function challengeFrom(event: { codeHash: string; expiresAt: Date; attempts: number; now: Date }) {
  return {
    codeHash: event.codeHash,
    expiresAt: event.expiresAt,
    attemptsRemaining: event.attempts,
    requestedAt: event.now,
  };
}

function rejected(
  contact: DeliveryContact,
  reason: Extract<DeliveryContactTransition, { outcome: "rejected" }>["reason"],
): DeliveryContactTransition {
  return { outcome: "rejected", reason, contact };
}
