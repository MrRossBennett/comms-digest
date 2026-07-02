import "@tanstack/react-start/server-only";
import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import {
  account,
  communicationSource,
  communicationSourceChild,
  schoolCommunication,
} from "@repo/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  type CommunicationFetcher,
  type ConfirmedSource,
  gmailPartSchema,
  type IngestionCandidate,
  readGmailMessageContent,
} from "./communication-fetcher";
import { parseSender } from "./communication-source";
import { gmailRequest } from "./gmail";
import { limitGmailSourceText, selectNewGmailMessages } from "./ingestion-limits";

// Confirmed Communication Sources for a Household, with selected Students resolved.
export async function listConfirmedSources(householdId: string): Promise<ConfirmedSource[]> {
  const sources = await db
    .select({
      id: communicationSource.id,
      schoolId: communicationSource.schoolId,
      senderName: communicationSource.senderName,
      senderDomain: communicationSource.senderDomain,
      audience: communicationSource.audience,
      discovery: communicationSource.discovery,
    })
    .from(communicationSource)
    .where(
      and(
        eq(communicationSource.householdId, householdId),
        eq(communicationSource.status, "confirmed"),
      ),
    );

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

  return sources.map((source) => ({
    ...source,
    childIds: selectedChildren
      .filter(({ communicationSourceId }) => communicationSourceId === source.id)
      .map(({ childId }) => childId),
  }));
}

const gmailMessageListSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).optional(),
});

const gmailPagedListSchema = gmailMessageListSchema.extend({
  nextPageToken: z.string().optional(),
});

const gmailMessageSchema = z.object({
  id: z.string().min(1),
  internalDate: z.string(),
  payload: gmailPartSchema,
});

// ─── Gmail adapter ───────────────────────────────────────────────────────────
// Fetches IngestionCandidates from Gmail for the Household's confirmed Gmail
// sources. paginate:true bypasses the per-sweep cap (backfill within 30d window).
export function createGmailFetcher(config: {
  ownerUserId: string;
  householdId: string;
  opts: { paginate: boolean };
}): CommunicationFetcher {
  return {
    fetch: async (sources) => {
      const gmailSources = sources.filter(({ discovery }) => discovery === "gmail");
      if (gmailSources.length === 0) return [];
      return fetchGmailCandidates(
        config.ownerUserId,
        config.householdId,
        gmailSources,
        config.opts,
      );
    },
  };
}

async function fetchGmailCandidates(
  ownerUserId: string,
  householdId: string,
  sources: ConfirmedSource[],
  opts: { paginate: boolean },
): Promise<IngestionCandidate[]> {
  const [googleAccount] = await db
    .select({
      scope: account.scope,
      refreshToken: account.refreshToken,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
    })
    .from(account)
    .where(and(eq(account.userId, ownerUserId), eq(account.providerId, "google")))
    .limit(1);

  if (!googleAccount?.scope?.includes("https://www.googleapis.com/auth/gmail.readonly")) {
    const err = Object.assign(
      new Error("Reconnect Gmail with read-only access before fetching communications"),
      { needsReauth: true },
    );
    throw err;
  }
  if (
    googleAccount.accessTokenExpiresAt &&
    googleAccount.accessTokenExpiresAt <= new Date() &&
    !googleAccount.refreshToken
  ) {
    const err = Object.assign(
      new Error("Your Gmail connection has expired. Reconnect Gmail from Sources."),
      { needsReauth: true },
    );
    throw err;
  }

  const { accessToken } = await auth.api.getAccessToken({
    body: { providerId: "google", userId: ownerUserId },
  });
  const listedMessages: Array<{ id: string; source: ConfirmedSource }> = [];

  for (const source of sources) {
    // In paginate mode (backfill), follow nextPageToken to collect all messages within the
    // 30d window. In steady-state, one page of 20 results is enough before deduplication.
    let pageToken: string | undefined;
    const MAX_PAGES = opts.paginate ? 50 : 1;
    let page = 0;
    do {
      const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
      url.searchParams.set("maxResults", "100");
      url.searchParams.set("q", `newer_than:30d from:${source.senderDomain}`);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const list = gmailPagedListSchema.parse(await gmailRequest(url.toString(), accessToken));
      listedMessages.push(...(list.messages ?? []).map(({ id }) => ({ id, source })));
      pageToken = list.nextPageToken;
      page += 1;
    } while (pageToken && page < MAX_PAGES);
  }

  const existingExternalIds =
    listedMessages.length === 0
      ? []
      : await db
          .select({ externalMessageId: schoolCommunication.externalMessageId })
          .from(schoolCommunication)
          .where(
            and(
              eq(schoolCommunication.householdId, householdId),
              inArray(
                schoolCommunication.externalMessageId,
                listedMessages.map(({ id }) => id),
              ),
            ),
          );

  // Steady-state: apply the per-sweep cap after deduplication.
  // Backfill (paginate:true): no cap — process everything within the 30d window.
  const messagesToFetch = opts.paginate
    ? listedMessages.filter(
        ({ id }) => !existingExternalIds.some(({ externalMessageId }) => externalMessageId === id),
      )
    : selectNewGmailMessages(
        listedMessages,
        new Set(existingExternalIds.map(({ externalMessageId }) => externalMessageId)),
      );
  const candidates: IngestionCandidate[] = [];

  for (const { id, source } of messagesToFetch) {
    const message = gmailMessageSchema.parse(
      await gmailRequest(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        accessToken,
      ),
    );
    const subject =
      message.payload.headers
        ?.find(({ name }) => name.toLocaleLowerCase("en-GB") === "subject")
        ?.value.trim() || "School communication";
    const fromHeader = message.payload.headers?.find(
      ({ name }) => name.toLocaleLowerCase("en-GB") === "from",
    )?.value;
    const sender = fromHeader ? parseSender(fromHeader) : null;
    if (!sender || sender.senderDomain !== source.senderDomain) continue;

    const sourceText = await readGmailMessageContent(message.payload, {
      downloadAttachment: ({ attachmentId }) =>
        downloadGmailAttachment(message.id, attachmentId, accessToken),
    });
    if (!sourceText) continue;

    candidates.push({
      source,
      externalMessageId: message.id,
      receivedAt: new Date(Number(message.internalDate)).toISOString(),
      subject,
      senderAddress: sender.senderAddress,
      sourceText: limitGmailSourceText(sourceText),
    });
  }

  return candidates;
}

async function downloadGmailAttachment(
  messageId: string,
  attachmentId: string,
  accessToken: string,
): Promise<string | null> {
  const response = z
    .object({ data: z.string() })
    .safeParse(
      await gmailRequest(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
        accessToken,
      ),
    );
  return response.success ? response.data.data : null;
}
