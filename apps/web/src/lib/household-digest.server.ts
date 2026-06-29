import { db } from "@repo/db";
import {
  citation as citationTable,
  claim as claimTable,
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
  reconcileDigest,
  resolveRelativeDate,
  schoolCommunicationSchema,
  validatedExtractionSchema,
} from "@repo/intelligence";
import { createLiveExtractor } from "@repo/intelligence/live";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  type CommunicationFetcher,
  createRecordedFetcher,
  type IngestionCandidate,
} from "./communication-fetcher";
import { createGmailFetcher, listConfirmedSources } from "./communication-fetcher.server";
import { listDismissedDigestEvidenceIds } from "./digest-item-status.server";
import { getErrorMessage } from "./error-message";
import { getHouseholdForOwner } from "./household.server";
import { listCompletedResponsibilityIds } from "./responsibility-status.server";

type HouseholdSetup = NonNullable<Awaited<ReturnType<typeof getHouseholdForOwner>>>;

// Which CommunicationFetchers a fetch+ingest run draws candidates from.
// Injectable so ingestion can be driven by a substitutable adapter in tests.
export type CommunicationFetcherFactory = (input: {
  ownerUserId: string;
  householdId: string;
  children: HouseholdSetup["children"];
  opts: { paginate: boolean };
}) => CommunicationFetcher[];

const defaultFetchers: CommunicationFetcherFactory = ({
  ownerUserId,
  householdId,
  children,
  opts,
}) => [createRecordedFetcher({ children }), createGmailFetcher({ ownerUserId, householdId, opts })];

// Shared fetch+ingest+rebuild core. Used by manual refresh, Inngest sweep, and backfill.
// paginate:true bypasses the per-sweep cap (backfill within 30d window).
export async function fetchAndIngestForHousehold(
  householdId: string,
  ownerUserId: string,
  opts: { paginate: boolean },
  deps: { createFetchers?: CommunicationFetcherFactory } = {},
): Promise<{ messagesExtracted: number; inputTokens: number; outputTokens: number }> {
  const householdSetup = await getHouseholdForOwner(ownerUserId);
  if (!householdSetup || householdSetup.id !== householdId) {
    throw new Error("Household not found");
  }

  const sources = await listConfirmedSources(householdId);
  const fetchers = (deps.createFetchers ?? defaultFetchers)({
    ownerUserId,
    householdId,
    children: householdSetup.children,
    opts,
  });
  const candidates = (await Promise.all(fetchers.map((fetcher) => fetcher.fetch(sources)))).flat();

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

export async function fetchNewCommunicationsForOwner(ownerUserId: string): Promise<
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

    // Re-resolve stored date wording on every load rather than trusting the date that was
    // resolved at ingestion. This keeps resolution as the single source of truth, so resolver
    // improvements reach already-stored School Communications without re-running extraction.
    const receivedAt = communicationRow.receivedAt.toISOString();
    const householdTimezone = "Europe/London";
    const resolve = (originalWording: string) =>
      resolveRelativeDate(originalWording, receivedAt, householdTimezone).resolvedDate;

    return validatedExtractionSchema.parse({
      communication: {
        id: communicationRow.id,
        kind: "email",
        schoolId: communicationRow.schoolId,
        sourceChildIds: communicationRow.sourceAudience === "children" ? scopedChildIds : undefined,
        receivedAt,
        householdTimezone,
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
                resolvedDate: resolve(claim.dateOriginalWording),
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
                resolvedDate: resolve(responsibility.dueDateOriginalWording),
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
