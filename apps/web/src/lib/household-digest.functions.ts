import { authMiddleware, freshAuthMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { household, responsibility } from "@repo/db/schema";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  fetchNewCommunicationsForOwner,
  getHouseholdDigestForOwner,
} from "./household-digest.server";
import { setResponsibilityCompleted } from "./responsibility-status.server";

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
    const [ownedResponsibility] = await db
      .select({ id: responsibility.id })
      .from(responsibility)
      .innerJoin(household, eq(responsibility.householdId, household.id))
      .where(
        and(
          eq(responsibility.id, data.responsibilityId),
          eq(household.ownerUserId, context.user.id),
        ),
      )
      .limit(1);

    if (!ownedResponsibility) throw new Error("Responsibility not found");

    await setResponsibilityCompleted(context.user.id, data.responsibilityId, data.completed);
    setResponseHeader("Cache-Control", "no-store");

    return data;
  });
