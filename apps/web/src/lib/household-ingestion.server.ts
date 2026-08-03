import "@tanstack/react-start/server-only";
import { db } from "@repo/db";
import { householdDigest, schoolCommunication } from "@repo/db/schema";
import { createExtractionWorkflow, schoolCommunicationSchema } from "@repo/intelligence";
import { createLiveExtractor } from "@repo/intelligence/live";
import { and, eq, inArray } from "drizzle-orm";

import {
  type CommunicationFetcher,
  createRecordedFetcher,
  type IngestionCandidate,
} from "./communication-fetcher";
import { createGmailFetcher, listConfirmedSources } from "./communication-fetcher.server";
import { filterNewCandidates } from "./household-ingestion";
import { getHouseholdForOwner } from "./household.server";
import { persistExtraction } from "./stored-evidence.server";

type HouseholdSetup = NonNullable<Awaited<ReturnType<typeof getHouseholdForOwner>>>;

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
  const newCandidates = filterNewCandidates(
    candidates,
    existingExternalIds.map(({ externalMessageId }) => externalMessageId),
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

  if (newCandidates.length > 0) await markHouseholdIngested(householdId);
  return { messagesExtracted, inputTokens, outputTokens };
}

async function ingestCandidate(
  householdId: string,
  candidate: IngestionCandidate,
  liveExtract: ReturnType<typeof createLiveExtractor>["extract"],
) {
  const communication = schoolCommunicationSchema.parse({
    id: crypto.randomUUID(),
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
  const result = await createExtractionWorkflow({ extract }).invoke({ communication });
  if (!result.validated) throw new Error("Communication extraction completed without output");

  await persistExtraction(householdId, candidate, result.validated);
}

export async function markHouseholdIngested(householdId: string) {
  await db
    .insert(householdDigest)
    .values({ id: crypto.randomUUID(), householdId, generatedAt: new Date() })
    .onConflictDoUpdate({
      target: householdDigest.householdId,
      set: { generatedAt: new Date() },
    });
}
