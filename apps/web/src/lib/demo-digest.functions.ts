import { authMiddleware, freshAuthMiddleware } from "@repo/auth/tanstack/middleware";
import { createDemoDigest, isDemoResponsibilityId } from "@repo/intelligence/demo";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  listCompletedResponsibilityIds,
  setResponsibilityCompleted,
} from "./responsibility-status.server";

export const $getDemoDigest = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const completedResponsibilityIds = await listCompletedResponsibilityIds(context.user.id);
    setResponseHeader("Cache-Control", "no-store");

    return createDemoDigest({ completedResponsibilityIds });
  });

export const $setDemoResponsibilityCompleted = createServerFn({
  method: "POST",
})
  .middleware([freshAuthMiddleware])
  .validator(
    z.object({
      responsibilityId: z.uuid(),
      completed: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!(await isDemoResponsibilityId(data.responsibilityId))) {
      throw new Error("Unknown Demo Household Responsibility");
    }

    await setResponsibilityCompleted(context.user.id, data.responsibilityId, data.completed);
    setResponseHeader("Cache-Control", "no-store");

    return data;
  });
