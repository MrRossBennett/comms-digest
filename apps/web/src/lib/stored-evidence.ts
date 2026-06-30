import type {
  citation,
  claim,
  responsibility,
  responsibilityClaim,
  schoolCommunication,
  schoolCommunicationChild,
} from "@repo/db/schema";
import {
  resolveRelativeDate,
  type ValidatedExtraction,
  validatedExtractionSchema,
} from "@repo/intelligence";

type CommunicationRow = typeof schoolCommunication.$inferInsert;
type CommunicationChildRow = typeof schoolCommunicationChild.$inferInsert;
type ClaimRow = typeof claim.$inferInsert;
type CitationRow = typeof citation.$inferInsert;
type ResponsibilityRow = typeof responsibility.$inferInsert;
type ResponsibilityClaimRow = typeof responsibilityClaim.$inferInsert;

export type StoredEvidenceRows = {
  communication: CommunicationRow;
  communicationChildren: CommunicationChildRow[];
  claims: ClaimRow[];
  citations: CitationRow[];
  responsibilities: ResponsibilityRow[];
  responsibilityClaims: ResponsibilityClaimRow[];
};

type StorageContext = {
  householdId: string;
  communicationSourceId: string;
  sourceAudience: NonNullable<CommunicationRow["sourceAudience"]>;
  externalMessageId: string;
  senderAddress: string;
};

export function toStoredEvidenceRows(
  extraction: ValidatedExtraction,
  context: StorageContext,
): StoredEvidenceRows {
  return {
    communication: {
      id: extraction.communication.id,
      householdId: context.householdId,
      communicationSourceId: context.communicationSourceId,
      schoolId: extraction.communication.schoolId,
      sourceAudience: context.sourceAudience,
      externalMessageId: context.externalMessageId,
      senderAddress: context.senderAddress,
      receivedAt: new Date(extraction.communication.receivedAt),
      subject: extraction.communication.subject,
      sourceText: extraction.communication.sourceText,
    },
    communicationChildren:
      extraction.communication.sourceChildIds?.map((childId) => ({
        communicationId: extraction.communication.id,
        childId,
      })) ?? [],
    claims: extraction.claims.map((extractedClaim) => ({
      id: extractedClaim.id,
      communicationId: extraction.communication.id,
      content: extractedClaim.content,
      audienceScope: extractedClaim.audience.scope,
      audienceOriginalWording: extractedClaim.audience.originalWording,
      certainty: extractedClaim.certainty,
      dateOriginalWording: extractedClaim.date?.originalWording,
      dateResolved: extractedClaim.date?.resolvedDate,
    })),
    citations: extraction.claims.flatMap((extractedClaim) =>
      extractedClaim.citations.map((extractedCitation) => ({
        id: extractedCitation.id,
        claimId: extractedClaim.id,
        communicationId: extraction.communication.id,
        quote: extractedCitation.quote,
        start: extractedCitation.start,
        end: extractedCitation.end,
      })),
    ),
    responsibilities: extraction.responsibilities.map((extractedResponsibility) => ({
      id: extractedResponsibility.id,
      householdId: context.householdId,
      title: extractedResponsibility.title,
      dueDateOriginalWording: extractedResponsibility.dueDate?.originalWording,
      dueDateResolved: extractedResponsibility.dueDate?.resolvedDate,
      amountCurrency: extractedResponsibility.amount?.currency,
      amountMinorUnits: extractedResponsibility.amount?.minorUnits,
    })),
    responsibilityClaims: extraction.responsibilities.flatMap((extractedResponsibility) =>
      extractedResponsibility.supportingClaimIds.map((claimId) => ({
        responsibilityId: extractedResponsibility.id,
        claimId,
      })),
    ),
  };
}

export function fromStoredEvidenceRows(rows: StoredEvidenceRows): ValidatedExtraction {
  const { communication } = rows;
  const receivedAt = communication.receivedAt.toISOString();
  const householdTimezone = "Europe/London";
  // Stored wording remains the source of truth. Re-resolving here means resolver improvements
  // reach existing School Communications without re-running extraction.
  const resolve = (originalWording: string) =>
    resolveRelativeDate(originalWording, receivedAt, householdTimezone).resolvedDate;
  const communicationClaims = rows.claims.filter(
    ({ communicationId }) => communicationId === communication.id,
  );

  return validatedExtractionSchema.parse({
    communication: {
      id: communication.id,
      kind: "email",
      schoolId: communication.schoolId,
      sourceChildIds:
        communication.sourceAudience === "children"
          ? rows.communicationChildren
              .filter(({ communicationId }) => communicationId === communication.id)
              .map(({ childId }) => childId)
          : undefined,
      receivedAt,
      householdTimezone,
      subject: communication.subject ?? undefined,
      sourceText: communication.sourceText,
    },
    claims: communicationClaims.map((storedClaim) => ({
      id: storedClaim.id,
      content: storedClaim.content,
      audience: {
        scope: storedClaim.audienceScope,
        originalWording: storedClaim.audienceOriginalWording,
      },
      certainty: storedClaim.certainty,
      date: storedClaim.dateOriginalWording
        ? {
            originalWording: storedClaim.dateOriginalWording,
            resolvedDate: resolve(storedClaim.dateOriginalWording),
          }
        : undefined,
      citations: rows.citations
        .filter(({ claimId }) => claimId === storedClaim.id)
        .map((storedCitation) => ({
          id: storedCitation.id,
          communicationId: storedCitation.communicationId,
          quote: storedCitation.quote,
          start: storedCitation.start,
          end: storedCitation.end,
        })),
    })),
    responsibilities: rows.responsibilities
      .filter((storedResponsibility) =>
        rows.responsibilityClaims.some(
          (link) =>
            link.responsibilityId === storedResponsibility.id &&
            communicationClaims.some(({ id }) => id === link.claimId),
        ),
      )
      .map((storedResponsibility) => ({
        id: storedResponsibility.id,
        title: storedResponsibility.title,
        dueDate: storedResponsibility.dueDateOriginalWording
          ? {
              originalWording: storedResponsibility.dueDateOriginalWording,
              resolvedDate: resolve(storedResponsibility.dueDateOriginalWording),
            }
          : undefined,
        amount:
          storedResponsibility.amountCurrency && storedResponsibility.amountMinorUnits !== null
            ? {
                currency: storedResponsibility.amountCurrency,
                minorUnits: storedResponsibility.amountMinorUnits,
              }
            : undefined,
        supportingClaimIds: rows.responsibilityClaims
          .filter(({ responsibilityId }) => responsibilityId === storedResponsibility.id)
          .map(({ claimId }) => claimId),
      })),
  });
}
