import { authMiddleware, freshAuthMiddleware } from "@repo/auth/tanstack/middleware";
import { db } from "@repo/db";
import { claim, household, responsibility, schoolCommunication } from "@repo/db/schema";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { setDigestEvidenceDismissed } from "./digest-item-status.server";
import {
  fetchNewCommunicationsForOwner,
  getHouseholdDigestForOwner,
} from "./household-digest.server";
import { setResponsibilityCompleted } from "./responsibility-status.server";

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
    const ownedClaims = await db
      .select({ id: claim.id })
      .from(claim)
      .innerJoin(schoolCommunication, eq(claim.communicationId, schoolCommunication.id))
      .innerJoin(household, eq(schoolCommunication.householdId, household.id))
      .where(and(inArray(claim.id, data.claimIds), eq(household.ownerUserId, context.user.id)));
    if (ownedClaims.length !== data.claimIds.length) throw new Error("Digest item not found");

    if (data.responsibilityIds.length > 0) {
      const ownedResponsibilities = await db
        .select({ id: responsibility.id })
        .from(responsibility)
        .innerJoin(household, eq(responsibility.householdId, household.id))
        .where(
          and(
            inArray(responsibility.id, data.responsibilityIds),
            eq(household.ownerUserId, context.user.id),
          ),
        );
      if (ownedResponsibilities.length !== data.responsibilityIds.length) {
        throw new Error("Digest item not found");
      }
    }

    await setDigestEvidenceDismissed(
      context.user.id,
      data.claimIds,
      data.responsibilityIds,
      data.dismissed,
    );
    setResponseHeader("Cache-Control", "no-store");

    return data;
  });
