import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { getDayPlanForOwner } from "./household-day-plan.server";

export const $getDayPlan = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ date: z.iso.date().optional() }).strict())
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store");
    return getDayPlanForOwner(context.user.id, data.date);
  });
