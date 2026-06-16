import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import {
  account,
  citation as citationTable,
  claim as claimTable,
  communicationSource,
  communicationSourceChild,
  digestItem,
  digestItemChild,
  digestItemClaim,
  digestItemResponsibility,
  householdDigest,
  responsibility as responsibilityTable,
  responsibilityClaim,
  schoolCommunication,
  schoolCommunicationChild,
} from "@repo/db/schema";
import {
  composeDigest,
  createExtractionWorkflow,
  modelExtractionSchema,
  reconcileDigest,
  schoolCommunicationSchema,
  validatedExtractionSchema,
} from "@repo/intelligence";
import { createLiveExtractor } from "@repo/intelligence/live";
import { and, asc, eq, inArray } from "drizzle-orm";
import { extractText } from "unpdf";
import { z } from "zod";

import { parseSender } from "./communication-source";
import { listDismissedDigestEvidenceIds } from "./digest-item-status.server";
import { getErrorMessage } from "./error-message";
import { gmailRequest } from "./gmail";
import { getHouseholdForOwner } from "./household.server";
import { limitGmailSourceText, selectNewGmailMessages } from "./ingestion-limits";
import { listCompletedResponsibilityIds } from "./responsibility-status.server";

const gmailMessageListSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).optional(),
});

type GmailPart = {
  mimeType?: string;
  body?: { data?: string; attachmentId?: string };
  headers?: Array<{ name: string; value: string }>;
  parts?: GmailPart[];
};

const gmailPartSchema: z.ZodType<GmailPart> = z.lazy(() =>
  z.object({
    mimeType: z.string().optional(),
    body: z.object({ data: z.string().optional(), attachmentId: z.string().optional() }).optional(),
    headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    parts: z.array(gmailPartSchema).optional(),
  }),
);

const gmailMessageSchema = z.object({
  id: z.string().min(1),
  internalDate: z.string(),
  payload: gmailPartSchema,
});

type ConfirmedSource = Awaited<ReturnType<typeof listConfirmedSources>>[number];
type IngestionCandidate = {
  source: ConfirmedSource;
  externalMessageId: string;
  receivedAt: string;
  subject: string;
  senderAddress: string;
  sourceText: string;
  recordedExtraction?: z.infer<typeof modelExtractionSchema>;
};

// Shared fetch+ingest+rebuild core. Used by manual refresh, Inngest sweep, and backfill.
// paginate:true bypasses the per-sweep cap (backfill within 30d window).
export async function fetchAndIngestForHousehold(
  householdId: string,
  ownerUserId: string,
  opts: { paginate: boolean },
): Promise<{ messagesExtracted: number; inputTokens: number; outputTokens: number }> {
  const householdSetup = await getHouseholdForOwner(ownerUserId);
  if (!householdSetup || householdSetup.id !== householdId) {
    throw new Error("Household not found");
  }

  const sources = await listConfirmedSources(householdId);
  const sampleCandidates = sources
    .filter(({ discovery }) => discovery === "sample")
    .map((source) => createSampleCandidate(source, householdSetup.children));
  const gmailSources = sources.filter(({ discovery }) => discovery === "gmail");
  const gmailCandidates =
    gmailSources.length > 0
      ? await fetchGmailCandidates(ownerUserId, householdId, gmailSources, opts)
      : [];
  const candidates = [...sampleCandidates, ...gmailCandidates];

  const existingExternalIds =
    candidates.length === 0
      ? []
      : await db
          .select({ externalMessageId: schoolCommunication.externalMessageId })
          .from(schoolCommunication)
          .where(
            and(
              eq(schoolCommunication.householdId, householdId),
              inArray(
                schoolCommunication.externalMessageId,
                candidates.map(({ externalMessageId }) => externalMessageId),
              ),
            ),
          );
  const existing = new Set(existingExternalIds.map(({ externalMessageId }) => externalMessageId));
  const newCandidates = candidates.filter(
    ({ externalMessageId }) => !existing.has(externalMessageId),
  );

  const liveExtractor = createLiveExtractor({ apiKey: process.env.ANTHROPIC_API_KEY });
  let messagesExtracted = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const candidate of newCandidates) {
    await ingestCandidate(householdId, candidate, liveExtractor.extract);
    messagesExtracted += 1;
    try {
      const meta = liveExtractor.getLastRunMetadata();
      inputTokens += meta.inputTokens;
      outputTokens += meta.outputTokens;
    } catch {
      // Sample/recorded extraction: no live model metadata
    }
  }

  await rebuildHouseholdDigest(householdId, householdSetup);
  return { messagesExtracted, inputTokens, outputTokens };
}

export async function fetchNewCommunicationsForOwner(
  ownerUserId: string,
): Promise<
  | {
      importedCount: number;
      syncing: false;
      digest: Awaited<ReturnType<typeof getHouseholdDigestForOwner>>;
    }
  | { syncing: true }
> {
  const householdSetup = await getHouseholdForOwner(ownerUserId);
  if (!householdSetup) throw new Error("Complete Household setup before fetching communications");

  const { tryMarkHouseholdSyncRunning, markHouseholdSyncIdle } =
    await import("./household-sync.server");

  const acquired = await tryMarkHouseholdSyncRunning(householdSetup.id);
  if (!acquired) {
    // A background sweep is already covering this Household.
    // Client should poll $getHouseholdSyncState until status === 'idle', then refetch.
    return { syncing: true };
  }

  try {
    const result = await fetchAndIngestForHousehold(householdSetup.id, ownerUserId, {
      paginate: false,
    });
    await markHouseholdSyncIdle(householdSetup.id, { success: true, ...result });
    return {
      syncing: false,
      importedCount: result.messagesExtracted,
      digest: await getHouseholdDigestForOwner(ownerUserId),
    };
  } catch (error) {
    const { isRootCauseReauth } = await import("./sync-error");
    await markHouseholdSyncIdle(householdSetup.id, {
      success: false,
      error: getErrorMessage(error, "Sync failed"),
      needsReauth: isRootCauseReauth(error),
    });
    throw error;
  }
}

export async function getHouseholdDigestForOwner(ownerUserId: string) {
  const householdSetup = await getHouseholdForOwner(ownerUserId);
  if (!householdSetup) return null;

  const [digestRow] = await db
    .select({ generatedAt: householdDigest.generatedAt })
    .from(householdDigest)
    .where(eq(householdDigest.householdId, householdSetup.id))
    .limit(1);

  const extractions = await loadExtractions(householdSetup.id);
  if (!digestRow || extractions.length === 0) {
    return {
      household: householdSetup,
      generatedAt: null,
      digest: null,
      communications: [],
      completedResponsibilityIds: [],
      dismissedClaimIds: [],
      dismissedResponsibilityIds: [],
    };
  }

  const householdConfig = {
    children: householdSetup.children.map((householdChild) => ({
      id: householdChild.id,
      name: householdChild.displayName,
      schoolYear: householdChild.schoolYear,
      schoolId: householdChild.schoolId,
    })),
  };
  const digest = composeDigest({
    household: householdConfig,
    extractions,
    reconciliation: reconcileDigest({ household: householdConfig, extractions }),
  });
  const dismissed = await listDismissedDigestEvidenceIds(ownerUserId);

  return {
    household: householdSetup,
    generatedAt: digestRow.generatedAt,
    digest,
    communications: extractions.map(({ communication }) => communication),
    completedResponsibilityIds: await listCompletedResponsibilityIds(ownerUserId),
    dismissedClaimIds: dismissed.claimIds,
    dismissedResponsibilityIds: dismissed.responsibilityIds,
  };
}

async function listConfirmedSources(householdId: string) {
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

function createSampleCandidate(
  source: ConfirmedSource,
  householdChildren: NonNullable<Awaited<ReturnType<typeof getHouseholdForOwner>>>["children"],
): IngestionCandidate {
  const receivedAt = "2026-06-12T15:30:00.000Z";
  const externalMessageId = `sample:${source.id}:first-digest`;

  if (source.audience === "children" && source.childIds.length > 0) {
    const name =
      householdChildren.find(({ id }) => id === source.childIds[0])?.displayName ?? "Your student";
    const sourceText = `${name}'s museum visit is on Wednesday 24 June. Please return the signed permission form by Friday 19 June.`;
    const eventQuote = `${name}'s museum visit is on Wednesday 24 June.`;
    const responsibilityQuote = "Please return the signed permission form by Friday 19 June.";

    return {
      source,
      externalMessageId,
      receivedAt,
      subject: `${name}'s museum visit`,
      senderAddress: `office@${source.senderDomain}`,
      sourceText,
      recordedExtraction: modelExtractionSchema.parse({
        claims: [
          {
            content: `${name}'s museum visit is on 24 June 2026.`,
            audience: { scope: "child", originalWording: name },
            certainty: "confirmed",
            date: { originalWording: "Wednesday 24 June", resolvedDate: "2026-06-24" },
            citations: [citationFor(sourceText, eventQuote)],
          },
          {
            content: `The signed permission form is due by 19 June 2026.`,
            audience: { scope: "child", originalWording: name },
            certainty: "confirmed",
            date: { originalWording: "Friday 19 June", resolvedDate: "2026-06-19" },
            citations: [citationFor(sourceText, responsibilityQuote)],
          },
        ],
        responsibilities: [
          {
            title: `Return the signed museum visit permission form`,
            dueDate: { originalWording: "Friday 19 June", resolvedDate: "2026-06-19" },
            claimPositions: [1],
          },
        ],
      }),
    };
  }

  const sourceText =
    "Sports day is on Friday 26 June. Children should arrive wearing their house colours.";
  const eventQuote = "Sports day is on Friday 26 June.";
  const infoQuote = "Children should arrive wearing their house colours.";

  return {
    source,
    externalMessageId,
    receivedAt,
    subject: "Sports day",
    senderAddress: `office@${source.senderDomain}`,
    sourceText,
    recordedExtraction: modelExtractionSchema.parse({
      claims: [
        {
          content: "Sports day is on 26 June 2026.",
          audience: {
            scope: source.audience === "household" ? "household" : "school",
            originalWording: source.audience === "household" ? "all families" : "the whole school",
          },
          certainty: "confirmed",
          date: { originalWording: "Friday 26 June", resolvedDate: "2026-06-26" },
          citations: [citationFor(sourceText, eventQuote)],
        },
        {
          content: "Children should wear their house colours for sports day.",
          audience: {
            scope: source.audience === "household" ? "household" : "school",
            originalWording: "Children",
          },
          certainty: "confirmed",
          citations: [citationFor(sourceText, infoQuote)],
        },
      ],
      responsibilities: [],
    }),
  };
}

function citationFor(sourceText: string, quote: string) {
  const start = sourceText.indexOf(quote);
  return { quote, start, end: start + quote.length };
}

const gmailPagedListSchema = gmailMessageListSchema.extend({
  nextPageToken: z.string().optional(),
});

async function fetchGmailCandidates(
  ownerUserId: string,
  householdId: string,
  sources: ConfirmedSource[],
  opts: { paginate: boolean },
) {
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
      message.payload.headers?.find(({ name }) => name.toLocaleLowerCase("en-GB") === "subject")
        ?.value ?? "School communication";
    const fromHeader = message.payload.headers?.find(
      ({ name }) => name.toLocaleLowerCase("en-GB") === "from",
    )?.value;
    const sender = fromHeader ? parseSender(fromHeader) : null;
    if (!sender || sender.senderDomain !== source.senderDomain) continue;
    const emailBodyText = extractGmailText(message.payload);
    const pdfParts = collectPdfParts(message.payload);
    const pdfSections: string[] = [];
    for (const pdfPart of pdfParts) {
      const data =
        pdfPart.body?.data ??
        (pdfPart.body?.attachmentId
          ? await downloadGmailAttachment(message.id, pdfPart.body.attachmentId, accessToken)
          : null);
      if (!data) continue;
      const filename = pdfPart.headers
        ?.find(({ name }) => name.toLowerCase() === "content-disposition")
        ?.value.match(/filename[^;=\n]*=\s*["']?([^"';\n]*)["']?/i)?.[1]
        ?.trim();
      const text = await extractPdfText(data);
      if (text) pdfSections.push(`--- Attachment: ${filename ?? "attachment.pdf"} ---\n\n${text}`);
    }

    const sourceText =
      emailBodyText || pdfSections.length > 0
        ? [emailBodyText, ...pdfSections].filter(Boolean).join("\n\n")
        : null;
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

async function ingestCandidate(
  householdId: string,
  candidate: IngestionCandidate,
  liveExtract: ReturnType<typeof createLiveExtractor>["extract"],
) {
  const communicationId = crypto.randomUUID();
  const communication = schoolCommunicationSchema.parse({
    id: communicationId,
    kind: "email",
    schoolId: candidate.source.audience === "household" ? null : candidate.source.schoolId,
    sourceChildIds:
      candidate.source.audience === "children" ? candidate.source.childIds : undefined,
    receivedAt: candidate.receivedAt,
    householdTimezone: "Europe/London",
    subject: candidate.subject,
    sourceText: candidate.sourceText,
  });
  const extract = candidate.recordedExtraction
    ? async () => candidate.recordedExtraction!
    : liveExtract;
  const workflow = createExtractionWorkflow({ extract });
  const result = await workflow.invoke({ communication });
  if (!result.validated) throw new Error("Communication extraction completed without output");

  await persistExtraction(householdId, candidate, result.validated);
}

async function persistExtraction(
  householdId: string,
  candidate: IngestionCandidate,
  extraction: z.infer<typeof validatedExtractionSchema>,
) {
  await db.transaction(async (transaction) => {
    const inserted = await transaction
      .insert(schoolCommunication)
      .values({
        id: extraction.communication.id,
        householdId,
        communicationSourceId: candidate.source.id,
        schoolId: extraction.communication.schoolId,
        sourceAudience: candidate.source.audience,
        externalMessageId: candidate.externalMessageId,
        senderAddress: candidate.senderAddress,
        receivedAt: new Date(extraction.communication.receivedAt),
        subject: extraction.communication.subject,
        sourceText: extraction.communication.sourceText,
      })
      .onConflictDoNothing({
        target: [schoolCommunication.householdId, schoolCommunication.externalMessageId],
      })
      .returning({ id: schoolCommunication.id });

    if (inserted.length === 0) return;

    if (extraction.communication.sourceChildIds?.length) {
      await transaction.insert(schoolCommunicationChild).values(
        extraction.communication.sourceChildIds.map((childId) => ({
          communicationId: extraction.communication.id,
          childId,
        })),
      );
    }

    if (extraction.claims.length > 0) {
      await transaction.insert(claimTable).values(
        extraction.claims.map((claim) => ({
          id: claim.id,
          communicationId: extraction.communication.id,
          content: claim.content,
          audienceScope: claim.audience.scope,
          audienceOriginalWording: claim.audience.originalWording,
          certainty: claim.certainty,
          dateOriginalWording: claim.date?.originalWording,
          dateResolved: claim.date?.resolvedDate,
        })),
      );
      await transaction.insert(citationTable).values(
        extraction.claims.flatMap((claim) =>
          claim.citations.map((citation) => ({
            id: citation.id,
            claimId: claim.id,
            communicationId: extraction.communication.id,
            quote: citation.quote,
            start: citation.start,
            end: citation.end,
          })),
        ),
      );
    }

    if (extraction.responsibilities.length > 0) {
      await transaction.insert(responsibilityTable).values(
        extraction.responsibilities.map((responsibility) => ({
          id: responsibility.id,
          householdId,
          title: responsibility.title,
          dueDateOriginalWording: responsibility.dueDate?.originalWording,
          dueDateResolved: responsibility.dueDate?.resolvedDate,
          amountCurrency: responsibility.amount?.currency,
          amountMinorUnits: responsibility.amount?.minorUnits,
        })),
      );
      await transaction.insert(responsibilityClaim).values(
        extraction.responsibilities.flatMap((responsibility) =>
          responsibility.supportingClaimIds.map((claimId) => ({
            responsibilityId: responsibility.id,
            claimId,
          })),
        ),
      );
    }
  });
}

async function loadExtractions(householdId: string) {
  const communications = await db
    .select()
    .from(schoolCommunication)
    .where(eq(schoolCommunication.householdId, householdId))
    .orderBy(asc(schoolCommunication.receivedAt));
  if (communications.length === 0) return [];

  const communicationIds = communications.map(({ id }) => id);
  const claims = await db
    .select()
    .from(claimTable)
    .where(inArray(claimTable.communicationId, communicationIds));
  const citations = await db
    .select()
    .from(citationTable)
    .where(inArray(citationTable.communicationId, communicationIds));
  const sourceChildren = await db
    .select()
    .from(schoolCommunicationChild)
    .where(inArray(schoolCommunicationChild.communicationId, communicationIds));
  const claimIds = claims.map(({ id }) => id);
  const responsibilityLinks =
    claimIds.length === 0
      ? []
      : await db
          .select()
          .from(responsibilityClaim)
          .where(inArray(responsibilityClaim.claimId, claimIds));
  const responsibilityIds = [
    ...new Set(responsibilityLinks.map(({ responsibilityId }) => responsibilityId)),
  ];
  const responsibilities =
    responsibilityIds.length === 0
      ? []
      : await db
          .select()
          .from(responsibilityTable)
          .where(inArray(responsibilityTable.id, responsibilityIds));

  return communications.map((communicationRow) => {
    const scopedChildIds = sourceChildren
      .filter(({ communicationId }) => communicationId === communicationRow.id)
      .map(({ childId }) => childId);

    return validatedExtractionSchema.parse({
      communication: {
        id: communicationRow.id,
        kind: "email",
        schoolId: communicationRow.schoolId,
        sourceChildIds: communicationRow.sourceAudience === "children" ? scopedChildIds : undefined,
        receivedAt: communicationRow.receivedAt.toISOString(),
        householdTimezone: "Europe/London",
        subject: communicationRow.subject ?? undefined,
        sourceText: communicationRow.sourceText,
      },
      claims: claims
        .filter(({ communicationId }) => communicationId === communicationRow.id)
        .map((claim) => ({
          id: claim.id,
          content: claim.content,
          audience: {
            scope: claim.audienceScope,
            originalWording: claim.audienceOriginalWording,
          },
          certainty: claim.certainty,
          date: claim.dateOriginalWording
            ? {
                originalWording: claim.dateOriginalWording,
                resolvedDate: claim.dateResolved,
              }
            : undefined,
          citations: citations
            .filter(({ claimId }) => claimId === claim.id)
            .map((citation) => ({
              id: citation.id,
              communicationId: citation.communicationId,
              quote: citation.quote,
              start: citation.start,
              end: citation.end,
            })),
        })),
      responsibilities: responsibilities
        .filter((responsibility) =>
          responsibilityLinks.some(
            (link) =>
              link.responsibilityId === responsibility.id &&
              claims.some(
                (claim) =>
                  claim.communicationId === communicationRow.id && claim.id === link.claimId,
              ),
          ),
        )
        .map((responsibility) => ({
          id: responsibility.id,
          title: responsibility.title,
          dueDate: responsibility.dueDateOriginalWording
            ? {
                originalWording: responsibility.dueDateOriginalWording,
                resolvedDate: responsibility.dueDateResolved,
              }
            : undefined,
          amount:
            responsibility.amountCurrency && responsibility.amountMinorUnits !== null
              ? {
                  currency: responsibility.amountCurrency,
                  minorUnits: responsibility.amountMinorUnits,
                }
              : undefined,
          supportingClaimIds: responsibilityLinks
            .filter(({ responsibilityId }) => responsibilityId === responsibility.id)
            .map(({ claimId }) => claimId),
        })),
    });
  });
}

export async function rebuildHouseholdDigest(
  householdId: string,
  householdSetup: NonNullable<Awaited<ReturnType<typeof getHouseholdForOwner>>>,
) {
  const extractions = await loadExtractions(householdId);
  if (extractions.length === 0) return;

  const householdConfig = {
    children: householdSetup.children.map((householdChild) => ({
      id: householdChild.id,
      name: householdChild.displayName,
      schoolYear: householdChild.schoolYear,
      schoolId: householdChild.schoolId,
    })),
  };
  const digest = composeDigest({
    household: householdConfig,
    extractions,
    reconciliation: reconcileDigest({ household: householdConfig, extractions }),
  });

  await db.transaction(async (transaction) => {
    const [existingDigest] = await transaction
      .select({ id: householdDigest.id })
      .from(householdDigest)
      .where(eq(householdDigest.householdId, householdId))
      .limit(1);
    const digestId = existingDigest?.id ?? crypto.randomUUID();

    if (existingDigest) {
      await transaction
        .update(householdDigest)
        .set({ generatedAt: new Date() })
        .where(eq(householdDigest.id, digestId));
      await transaction.delete(digestItem).where(eq(digestItem.digestId, digestId));
    } else {
      await transaction.insert(householdDigest).values({ id: digestId, householdId });
    }

    const items = [
      ...digest.actNow.map((item) => ({ section: "act_now" as const, item })),
      ...digest.comingUp.map((item) => ({ section: "coming_up" as const, item })),
      ...digest.goodToKnow.map((item) => ({ section: "good_to_know" as const, item })),
    ].map((entry, position) => ({
      id: crypto.randomUUID(),
      position,
      ...entry,
    }));

    if (items.length === 0) return;

    await transaction.insert(digestItem).values(
      items.map(({ id, position, section, item }) => ({
        id,
        digestId,
        section,
        title: item.title,
        position,
      })),
    );
    await transaction
      .insert(digestItemChild)
      .values(
        items.flatMap(({ id, item }) =>
          item.childIds.map((childId) => ({ digestItemId: id, childId })),
        ),
      );
    await transaction
      .insert(digestItemClaim)
      .values(
        items.flatMap(({ id, item }) =>
          item.claims.map((claim) => ({ digestItemId: id, claimId: claim.id })),
        ),
      );
    const responsibilityItems = items.flatMap(({ id, item }) =>
      item.responsibilities.map((responsibility) => ({
        digestItemId: id,
        responsibilityId: responsibility.id,
      })),
    );
    if (responsibilityItems.length > 0) {
      await transaction.insert(digestItemResponsibility).values(responsibilityItems);
    }
  });
}

function extractGmailText(payload: z.infer<typeof gmailPartSchema>) {
  const plainParts: string[] = [];
  const visit = (part: z.infer<typeof gmailPartSchema>) => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      plainParts.push(decodeBase64Url(part.body.data));
    }
    part.parts?.forEach(visit);
  };
  visit(payload);

  const text = plainParts.join("\n\n").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  return text || null;
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8");
}

function collectPdfParts(payload: z.infer<typeof gmailPartSchema>) {
  const parts: z.infer<typeof gmailPartSchema>[] = [];
  const visit = (part: z.infer<typeof gmailPartSchema>) => {
    if (part.mimeType === "application/pdf" && (part.body?.data || part.body?.attachmentId)) {
      parts.push(part);
    }
    part.parts?.forEach(visit);
  };
  visit(payload);
  return parts;
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

async function extractPdfText(base64UrlData: string): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64UrlData.replaceAll("-", "+").replaceAll("_", "/"), "base64");
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    const cleaned = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
    return cleaned || null;
  } catch {
    return null;
  }
}
