import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { getDayPlanForOwner } from "./household-day-plan.server";

export const $getDayPlan = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    return getDayPlanForOwner(context.user.id);
  });
