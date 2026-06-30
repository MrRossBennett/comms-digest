import { authMiddleware, freshAuthMiddleware } from "@repo/auth/tanstack/middleware";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { setEvidenceDismissed, setResponsibilityCompleted } from "./evidence-status.server";
import {
  fetchNewCommunicationsForOwner,
  getHouseholdDigestForOwner,
} from "./household-digest.server";

const uniqueUuidArray = z
  .array(z.uuid())
  .refine((values) => new Set(values).size === values.length, "Expected unique IDs");

export const $getHouseholdDigest = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    return getHouseholdDigestForOwner(context.user.id);
  });

export const $fetchNewCommunications = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    return fetchNewCommunicationsForOwner(context.user.id);
  });

export const $setHouseholdResponsibilityCompleted = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .validator(
    z.object({
      responsibilityId: z.uuid(),
      completed: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    await setResponsibilityCompleted(context.user.id, data.responsibilityId, data.completed);
    setResponseHeader("Cache-Control", "no-store");

    return data;
  });

export const $setHouseholdDigestItemDismissed = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .validator(
    z.object({
      claimIds: uniqueUuidArray.min(1),
      responsibilityIds: uniqueUuidArray,
      dismissed: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    await setEvidenceDismissed(
      context.user.id,
      data.claimIds,
      data.responsibilityIds,
      data.dismissed,
    );
    setResponseHeader("Cache-Control", "no-store");

    return data;
  });
