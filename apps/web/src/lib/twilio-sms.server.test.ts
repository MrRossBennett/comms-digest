import { createHmac } from "node:crypto";

import { afterEach, expect, test, vi } from "vite-plus/test";

import { TwilioSmsChannel, validateTwilioSignature } from "./twilio-sms.server";

afterEach(() => vi.unstubAllGlobals());

test("Twilio adapter sends the SMS and status callback through the Messages API", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ sid: "SM123" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const channel = new TwilioSmsChannel({
    accountSid: "AC123",
    authToken: "secret",
    fromNumber: "+447700900000",
  });

  await expect(
    channel.send({
      to: "+447700900123",
      body: "For tomorrow: View your Day Plan",
      statusCallbackUrl: "https://comms.example/api/twilio",
    }),
  ).resolves.toEqual({ messageId: "SM123" });
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toContain("/Accounts/AC123/Messages.json");
  expect(init.method).toBe("POST");
  expect(init.body).toBeInstanceOf(URLSearchParams);
  const body = init.body as URLSearchParams;
  expect(body.get("To")).toBe("+447700900123");
  expect(body.get("StatusCallback")).toBe("https://comms.example/api/twilio");
});

test("validates Twilio's signed URL and sorted form parameters", () => {
  const authToken = "test-auth-token";
  const url = "https://comms.example/api/twilio";
  const params = { From: "+447700900123", Body: "STOP" };
  const payload = `${url}BodySTOPFrom+447700900123`;
  const signature = createHmac("sha1", authToken).update(payload).digest("base64");

  expect(validateTwilioSignature({ authToken, signature, url, params })).toBe(true);
  expect(
    validateTwilioSignature({ authToken, signature, url, params: { ...params, Body: "START" } }),
  ).toBe(false);
});
