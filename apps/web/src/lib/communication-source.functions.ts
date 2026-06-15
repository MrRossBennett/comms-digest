import { authMiddleware, freshAuthMiddleware } from "@repo/auth/tanstack/middleware";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import {
  communicationSourceCreateSchema,
  communicationSourceReviewSchema,
} from "./communication-source";
import {
  createCommunicationSourceForOwner,
  discoverSampleSourcesForOwner,
  getSourceReviewForOwner,
  saveCommunicationSourceReviewForOwner,
  scanGmailSourcesForOwner,
} from "./communication-source.server";

export const $getSourceReview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    return getSourceReviewForOwner(context.user.id);
  });

export const $discoverSampleSources = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    return discoverSampleSourcesForOwner(context.user.id);
  });

export const $scanGmailSources = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    return scanGmailSourcesForOwner(context.user.id);
  });

export const $createCommunicationSource = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .validator(communicationSourceCreateSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store");
    return createCommunicationSourceForOwner(context.user.id, data);
  });

export const $saveCommunicationSourceReview = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .validator(communicationSourceReviewSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store");
    return saveCommunicationSourceReviewForOwner(context.user.id, data);
  });
