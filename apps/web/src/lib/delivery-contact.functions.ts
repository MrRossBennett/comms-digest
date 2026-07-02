import { authMiddleware, freshAuthMiddleware } from "@repo/auth/tanstack/middleware";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { e164PhoneNumberSchema } from "./delivery-contact";
import {
  deleteDeliveryContactForOwner,
  getDeliverySettingsForOwner,
  replaceDeliveryContactForOwner,
  requestDeliveryContactCodeForOwner,
  setDeliveryConsentForOwner,
  verifyDeliveryContactForOwner,
} from "./delivery-contact.server";

export const $getDeliverySettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    return getDeliverySettingsForOwner(context.user.id);
  });

export const $replaceDeliveryContact = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .validator(z.object({ phoneNumber: e164PhoneNumberSchema }).strict())
  .handler(async ({ context, data }) =>
    replaceDeliveryContactForOwner(context.user.id, data.phoneNumber),
  );

export const $requestDeliveryContactCode = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .handler(async ({ context }) => requestDeliveryContactCodeForOwner(context.user.id));

export const $verifyDeliveryContact = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .validator(
    z
      .object({
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/),
      })
      .strict(),
  )
  .handler(async ({ context, data }) => verifyDeliveryContactForOwner(context.user.id, data.code));

export const $setDeliveryConsent = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .validator(z.object({ optedIn: z.boolean() }).strict())
  .handler(async ({ context, data }) => setDeliveryConsentForOwner(context.user.id, data.optedIn));

export const $deleteDeliveryContact = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .handler(async ({ context }) => deleteDeliveryContactForOwner(context.user.id));
