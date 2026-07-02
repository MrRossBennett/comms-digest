import { describe, expect, test } from "vite-plus/test";

import { canDeliverTo, transitionDeliveryContact, type DeliveryContact } from "./delivery-contact";

const now = new Date("2026-07-02T17:00:00Z");
const later = new Date("2026-07-02T17:10:00Z");

describe("Delivery Contact consent", () => {
  test("a replacement number is unverified until the current code is proved", () => {
    const replaced = replace(optedIn());
    expect(replaced.consent).toBe("unverified");
    expect(canDeliverTo(replaced)).toBe(false);

    const verified = transitionDeliveryContact(replaced, {
      type: "verify",
      codeHash: "right",
      now,
    });
    expect(verified).toEqual({
      outcome: "changed",
      contact: { phoneNumber: "+447700900124", consent: "opted_in" },
    });
    expect(canDeliverTo(verified.contact)).toBe(true);
  });

  test.each(["opt_out", "stop"] as const)("%s opts a verified contact out", (type) => {
    const result = transitionDeliveryContact(optedIn(), { type });
    expect(result.contact.consent).toBe("opted_out");
    expect(canDeliverTo(result.contact)).toBe(false);
  });

  test.each(["opt_in", "start"] as const)("%s opts an opted-out contact back in", (type) => {
    const result = transitionDeliveryContact({ ...optedIn(), consent: "opted_out" }, { type });
    expect(result.contact.consent).toBe("opted_in");
  });

  test("illegal consent transitions fail closed", () => {
    const unverified = replace(null);
    expect(transitionDeliveryContact(unverified, { type: "opt_out" }).outcome).toBe("rejected");
    expect(transitionDeliveryContact(optedIn(), { type: "opt_in" }).outcome).toBe("rejected");
    expect(canDeliverTo(unverified)).toBe(false);
  });

  test("expired and exhausted verification codes fail closed", () => {
    const contact = replace(null);
    const expired = transitionDeliveryContact(contact, {
      type: "verify",
      codeHash: "right",
      now: later,
    });
    expect(expired).toMatchObject({ outcome: "rejected", reason: "code_expired" });
    expect(canDeliverTo(expired.contact)).toBe(false);

    let attempted = contact;
    for (let index = 0; index < 3; index += 1) {
      attempted = transitionDeliveryContact(attempted, {
        type: "verify",
        codeHash: "wrong",
        now,
      }).contact;
    }
    expect(
      transitionDeliveryContact(attempted, { type: "verify", codeHash: "right", now }),
    ).toMatchObject({ outcome: "rejected", reason: "code_exhausted" });
    expect(canDeliverTo(attempted)).toBe(false);
  });

  test("verification code requests are throttled", () => {
    expect(
      transitionDeliveryContact(replace(null), {
        type: "request_code",
        codeHash: "new",
        now: new Date(now.getTime() + 30_000),
        expiresAt: later,
        attempts: 3,
      }),
    ).toMatchObject({ outcome: "rejected", reason: "code_throttled" });
  });
});

function optedIn(): DeliveryContact {
  return { phoneNumber: "+447700900123", consent: "opted_in" };
}

function replace(contact: DeliveryContact | null): DeliveryContact {
  return transitionDeliveryContact(contact, {
    type: "replace_number",
    phoneNumber: "+447700900124",
    codeHash: "right",
    now,
    expiresAt: new Date("2026-07-02T17:05:00Z"),
    attempts: 3,
  }).contact;
}
