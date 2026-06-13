import { authMiddleware, freshAuthMiddleware } from "@repo/auth/tanstack/middleware";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { householdSetupSchema } from "./household";
import { getHouseholdForOwner, saveHouseholdForOwner } from "./household.server";

export const $getHousehold = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    return getHouseholdForOwner(context.user.id);
  });

export const $saveHousehold = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .validator(householdSetupSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store");
    return saveHouseholdForOwner(context.user.id, data);
  });
