import "@tanstack/react-start/server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

import { type DeliveryChannel, FakeDeliveryChannel } from "./day-plan-delivery";

export class TwilioSmsChannel implements DeliveryChannel {
  constructor(
    private readonly config: { accountSid: string; authToken: string; fromNumber: string },
  ) {}

  async send(message: { to: string; body: string; statusCallbackUrl?: string }) {
    const form = new URLSearchParams({
      To: message.to,
      From: this.config.fromNumber,
      Body: message.body,
    });
    if (message.statusCallbackUrl) form.set("StatusCallback", message.statusCallbackUrl);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      },
    );
    const result = (await response.json()) as { sid?: string; message?: string };
    if (!response.ok || !result.sid) {
      throw new Error(result.message ?? `Twilio send failed (${response.status})`);
    }
    return { messageId: result.sid };
  }
}

const fakeChannel = new FakeDeliveryChannel();

export function getSmsDeliveryChannel(): DeliveryChannel {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (accountSid && authToken && fromNumber) {
    return new TwilioSmsChannel({ accountSid, authToken, fromNumber });
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Twilio SMS credentials are not configured");
  }
  return {
    async send(message) {
      console.info("[sms:fake]", message);
      return fakeChannel.send(message);
    },
  };
}

export function validateTwilioSignature(input: {
  authToken: string;
  signature: string;
  url: string;
  params: Record<string, string>;
}) {
  const payload =
    input.url +
    Object.entries(input.params)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}${value}`)
      .join("");
  const expected = createHmac("sha1", input.authToken).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(input.signature, "base64");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
