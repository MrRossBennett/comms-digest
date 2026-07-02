import { createFileRoute } from "@tanstack/react-router";

import { dayPlanDeliveryRetryEvent, inngest } from "#/inngest/client";
import { updateDeliveryStatus } from "#/lib/day-plan-delivery.server";
import { reconcileInboundConsent } from "#/lib/delivery-contact.server";
import { validateTwilioSignature } from "#/lib/twilio-sms.server";

export const Route = createFileRoute("/api/twilio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const params = Object.fromEntries(
          [...form.entries()].flatMap(([key, value]) =>
            typeof value === "string" ? [[key, value] as const] : [],
          ),
        );
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const signature = request.headers.get("x-twilio-signature") ?? "";
        const url = process.env.TWILIO_WEBHOOK_URL ?? request.url;
        if (!authToken || !validateTwilioSignature({ authToken, signature, url, params })) {
          return new Response("Invalid signature", { status: 401 });
        }

        const messageSid = params.MessageSid;
        const messageStatus = params.MessageStatus;
        if (messageSid && messageStatus) {
          const retry = await updateDeliveryStatus(messageSid, messageStatus.toLowerCase());
          if (retry) {
            await inngest.send(
              dayPlanDeliveryRetryEvent.create({
                householdId: retry.householdId,
                planDate: retry.planDate,
              }),
            );
          }
        } else {
          const from = params.From;
          const keyword = params.Body?.trim().toLowerCase();
          if (from && (keyword === "stop" || keyword === "start")) {
            const matched = await reconcileInboundConsent(from, keyword);
            if (!matched) console.info("[sms:inbound] Unrecognised sender", { from });
          } else {
            console.info("[sms:inbound] Ignored payload", { from, keyword });
          }
        }

        return new Response("<Response></Response>", {
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
