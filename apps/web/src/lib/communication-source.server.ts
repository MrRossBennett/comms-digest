import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import {
  account,
  child,
  communicationSource,
  communicationSourceChild,
  household,
  school,
} from "@repo/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  communicationSourceReviewSchema,
  hasGmailReadonlyScope,
  parseSender,
} from "./communication-source";
import { getHouseholdForOwner } from "./household.server";

const gmailMessageListSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).optional(),
});

const gmailMessageMetadataSchema = z.object({
  internalDate: z.string().optional(),
  payload: z
    .object({
      headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    })
    .optional(),
});

const GMAIL_QUERY =
  "newer_than:90d (school OR parentmail OR arbor OR classcharts OR classdojo OR newsletter OR trip OR year)";

export async function getSourceReviewForOwner(ownerUserId: string) {
  const householdSetup = await getHouseholdForOwner(ownerUserId);
  if (!householdSetup) return null;

  const googleAccounts = await db
    .select({ scope: account.scope })
    .from(account)
    .where(and(eq(account.userId, ownerUserId), eq(account.providerId, "google")));

  const sources = await db
    .select({
      id: communicationSource.id,
      schoolId: communicationSource.schoolId,
      senderName: communicationSource.senderName,
      senderAddress: communicationSource.senderAddress,
      status: communicationSource.status,
      audience: communicationSource.audience,
      discovery: communicationSource.discovery,
      messageCount: communicationSource.messageCount,
      lastSeenAt: communicationSource.lastSeenAt,
    })
    .from(communicationSource)
    .where(eq(communicationSource.householdId, householdSetup.id))
    .orderBy(desc(communicationSource.lastSeenAt), communicationSource.senderName);

  const selectedChildren =
    sources.length === 0
      ? []
      : await db
          .select({
            communicationSourceId: communicationSourceChild.communicationSourceId,
            childId: communicationSourceChild.childId,
          })
          .from(communicationSourceChild)
          .where(
            inArray(
              communicationSourceChild.communicationSourceId,
              sources.map(({ id }) => id),
            ),
          );

  return {
    household: householdSetup,
    gmailConnected: googleAccounts.some(({ scope }) => hasGmailReadonlyScope(scope)),
    sources: sources.map((source) => ({
      ...source,
      childIds: selectedChildren
        .filter(({ communicationSourceId }) => communicationSourceId === source.id)
        .map(({ childId }) => childId),
    })),
  };
}

export async function discoverSampleSourcesForOwner(ownerUserId: string) {
  const householdSetup = await getHouseholdForOwner(ownerUserId);
  if (!householdSetup) throw new Error("Complete Household setup before reviewing sources");

  await db
    .insert(communicationSource)
    .values(
      householdSetup.schools.flatMap((householdSchool, index) => {
        const slug = householdSchool.name
          .toLocaleLowerCase("en-GB")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        return [
          {
            id: crypto.randomUUID(),
            householdId: householdSetup.id,
            schoolId: householdSchool.id,
            senderName: `${householdSchool.name} Office`,
            senderAddress: `office-${slug || index + 1}@example.school`,
            discovery: "sample" as const,
            messageCount: 6,
            lastSeenAt: new Date("2026-06-12T15:30:00.000Z"),
          },
          {
            id: crypto.randomUUID(),
            householdId: householdSetup.id,
            schoolId: householdSchool.id,
            senderName: `ParentMail · ${householdSchool.name}`,
            senderAddress: `parentmail-${slug || index + 1}@example.school`,
            discovery: "sample" as const,
            messageCount: 3,
            lastSeenAt: new Date("2026-06-10T08:15:00.000Z"),
          },
        ];
      }),
    )
    .onConflictDoNothing({
      target: [communicationSource.householdId, communicationSource.senderAddress],
    });

  return getSourceReviewForOwner(ownerUserId);
}

export async function scanGmailSourcesForOwner(ownerUserId: string) {
  const sourceReview = await getSourceReviewForOwner(ownerUserId);
  if (!sourceReview) throw new Error("Complete Household setup before connecting Gmail");
  if (!sourceReview.gmailConnected) throw new Error("Connect Gmail before scanning for sources");

  const { accessToken } = await auth.api.getAccessToken({
    body: {
      providerId: "google",
      userId: ownerUserId,
    },
  });

  const messageList = gmailMessageListSchema.parse(
    await gmailRequest(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(GMAIL_QUERY)}`,
      accessToken,
    ),
  );

  const metadata = await Promise.all(
    (messageList.messages ?? []).map(async ({ id }) =>
      gmailMessageMetadataSchema.parse(
        await gmailRequest(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From`,
          accessToken,
        ),
      ),
    ),
  );

  const senders = new Map<
    string,
    { senderName: string; senderAddress: string; messageCount: number; lastSeenAt: Date | null }
  >();

  for (const message of metadata) {
    const fromHeader = message.payload?.headers?.find(
      ({ name }) => name.toLocaleLowerCase("en-GB") === "from",
    );
    const sender = fromHeader ? parseSender(fromHeader.value) : null;
    if (!sender) continue;

    const receivedAtMilliseconds = message.internalDate ? Number(message.internalDate) : null;
    const receivedAt =
      receivedAtMilliseconds !== null && Number.isFinite(receivedAtMilliseconds)
        ? new Date(receivedAtMilliseconds)
        : null;
    const existing = senders.get(sender.senderAddress);

    senders.set(sender.senderAddress, {
      ...sender,
      messageCount: (existing?.messageCount ?? 0) + 1,
      lastSeenAt:
        receivedAt && (!existing?.lastSeenAt || receivedAt > existing.lastSeenAt)
          ? receivedAt
          : (existing?.lastSeenAt ?? null),
    });
  }

  if (senders.size > 0) {
    await db
      .insert(communicationSource)
      .values(
        [...senders.values()].map((sender) => ({
          id: crypto.randomUUID(),
          householdId: sourceReview.household.id,
          senderName: sender.senderName,
          senderAddress: sender.senderAddress,
          discovery: "gmail" as const,
          messageCount: sender.messageCount,
          lastSeenAt: sender.lastSeenAt,
        })),
      )
      .onConflictDoUpdate({
        target: [communicationSource.householdId, communicationSource.senderAddress],
        set: {
          senderName: sql`excluded.sender_name`,
          discovery: sql`excluded.discovery`,
          messageCount: sql`excluded.message_count`,
          lastSeenAt: sql`excluded.last_seen_at`,
          updatedAt: sql`now()`,
        },
      });
  }

  return getSourceReviewForOwner(ownerUserId);
}

export async function saveCommunicationSourceReviewForOwner(ownerUserId: string, input: unknown) {
  const review = communicationSourceReviewSchema.parse(input);

  await db.transaction(async (transaction) => {
    const [ownedSource] = await transaction
      .select({
        id: communicationSource.id,
        householdId: communicationSource.householdId,
      })
      .from(communicationSource)
      .innerJoin(household, eq(communicationSource.householdId, household.id))
      .where(
        and(eq(communicationSource.id, review.sourceId), eq(household.ownerUserId, ownerUserId)),
      )
      .limit(1);

    if (!ownedSource) throw new Error("Communication Source not found");

    if (review.status === "confirmed" && review.schoolId) {
      const [ownedSchool] = await transaction
        .select({ id: school.id })
        .from(school)
        .where(and(eq(school.id, review.schoolId), eq(school.householdId, ownedSource.householdId)))
        .limit(1);
      if (!ownedSchool) throw new Error("School not found");
    }

    if (review.status === "confirmed" && review.audience === "children") {
      const selectedChildren = await transaction
        .select({ id: child.id, schoolId: child.schoolId })
        .from(child)
        .where(
          and(eq(child.householdId, ownedSource.householdId), inArray(child.id, review.childIds)),
        );

      if (
        selectedChildren.length !== review.childIds.length ||
        selectedChildren.some(({ schoolId }) => schoolId !== review.schoolId)
      ) {
        throw new Error("Every selected Child must belong to the selected School");
      }
    }

    const schoolId =
      review.status === "confirmed" && review.audience !== "household" ? review.schoolId : null;
    const audience = review.status === "confirmed" ? review.audience : "school";

    await transaction
      .update(communicationSource)
      .set({
        status: review.status,
        audience,
        schoolId,
      })
      .where(eq(communicationSource.id, ownedSource.id));

    await transaction
      .delete(communicationSourceChild)
      .where(eq(communicationSourceChild.communicationSourceId, ownedSource.id));

    if (review.status === "confirmed" && review.audience === "children") {
      await transaction.insert(communicationSourceChild).values(
        review.childIds.map((childId) => ({
          communicationSourceId: ownedSource.id,
          childId,
        })),
      );
    }
  });

  return getSourceReviewForOwner(ownerUserId);
}

async function gmailRequest(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Gmail scan failed with status ${response.status}`);
  }

  return response.json();
}
