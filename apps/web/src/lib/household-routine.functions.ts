import { authMiddleware, freshAuthMiddleware } from "@repo/auth/tanstack/middleware";
import { householdRoutineInputSchema } from "@repo/intelligence";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  deleteHouseholdRoutineForOwner,
  listHouseholdRoutinesForOwner,
  saveHouseholdRoutineForOwner,
} from "./household-routine.server";

export const $listHouseholdRoutines = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    return listHouseholdRoutinesForOwner(context.user.id);
  });

export const $saveHouseholdRoutine = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .validator(householdRoutineInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store");
    return saveHouseholdRoutineForOwner(context.user.id, data);
  });

export const $deleteHouseholdRoutine = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store");
    return deleteHouseholdRoutineForOwner(context.user.id, data.id);
  });
