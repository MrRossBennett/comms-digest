import { authMiddleware } from "@repo/auth/tanstack/middleware";
import { createDemoDigest } from "@repo/intelligence/demo";
import { createServerFn } from "@tanstack/react-start";

export const $getDemoDigest = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => createDemoDigest());
