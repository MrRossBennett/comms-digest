import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import {
  modelExtractionSchema,
  schoolCommunicationSchema,
  validatedExtractionSchema,
  type ModelExtraction,
} from "./contracts";
import { resolveRelativeDate } from "./dates";

const generatedIdSchema = z.uuid();

export class GroundingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroundingError";
  }
}

/**
 * Derive each Citation's character offsets from its verbatim quote rather than trusting
 * the offsets the model produced. The milestone-1 baseline showed the model copies short
 * quotes reliably but miscounts character positions, so we treat the model's `start` as a
 * hint and snap to the nearest exact occurrence of the quote in the source text. Quotes
 * that are not a verbatim substring are left untouched, so {@link validateAndIdentifyExtraction}
 * still fails closed on genuinely ungrounded claims. See issue #1 (Citation offsets decision).
 */
export function alignExtractionCitations(
  sourceText: string,
  extraction: ModelExtraction,
): ModelExtraction {
  return {
    ...extraction,
    claims: extraction.claims.map((claim) => ({
      ...claim,
      citations: claim.citations.map((citation) => {
        const occurrences: number[] = [];
        for (
          let index = sourceText.indexOf(citation.quote);
          index !== -1;
          index = sourceText.indexOf(citation.quote, index + 1)
        ) {
          occurrences.push(index);
        }

        if (occurrences.length === 0) {
          return citation;
        }

        const start = occurrences.reduce((best, candidate) =>
          Math.abs(candidate - citation.start) < Math.abs(best - citation.start) ? candidate : best,
        );

        return { ...citation, start, end: start + citation.quote.length };
      }),
    })),
  };
}

export function validateAndIdentifyExtraction(
  communicationInput: unknown,
  extractionInput: unknown,
  createId = uuidv7,
) {
  const communication = schoolCommunicationSchema.parse(communicationInput);
  const extraction = modelExtractionSchema.parse(extractionInput);

  for (const claim of extraction.claims) {
    for (const citation of claim.citations) {
      const passage = communication.sourceText.slice(citation.start, citation.end);
      if (passage !== citation.quote) {
        throw new GroundingError(
          `Citation offsets ${citation.start}:${citation.end} do not identify the exact quote`,
        );
      }
    }

    if (claim.date) {
      verifyResolvedDate(claim.date, communication.receivedAt, communication.householdTimezone);
    }
  }

  for (const responsibility of extraction.responsibilities) {
    if (responsibility.dueDate) {
      verifyResolvedDate(
        responsibility.dueDate,
        communication.receivedAt,
        communication.householdTimezone,
      );
    }

    for (const position of responsibility.claimPositions) {
      if (!extraction.claims[position]) {
        throw new GroundingError(`Responsibility references missing Claim position ${position}`);
      }
    }
  }

  const claims = extraction.claims.map((claim) => {
    const citations = claim.citations.map((citation) => ({
      ...citation,
      id: generatedIdSchema.parse(createId()),
      communicationId: communication.id,
    }));

    return {
      ...claim,
      id: generatedIdSchema.parse(createId()),
      citations,
    };
  });

  const responsibilities = extraction.responsibilities.map((responsibility) => {
    const supportingClaimIds = responsibility.claimPositions.map(
      (position) => claims[position]?.id,
    );

    return {
      id: generatedIdSchema.parse(createId()),
      title: responsibility.title,
      dueDate: responsibility.dueDate,
      amount: responsibility.amount,
      supportingClaimIds,
    };
  });

  return validatedExtractionSchema.parse({
    communication,
    claims,
    responsibilities,
  });
}

function verifyResolvedDate(
  date: { originalWording: string; resolvedDate: string | null },
  receivedAt: string,
  householdTimezone: string,
) {
  const expected = resolveRelativeDate(date.originalWording, receivedAt, householdTimezone);
  if (date.resolvedDate !== expected.resolvedDate) {
    throw new GroundingError(
      `Resolved date for "${date.originalWording}" is not supported by the School Communication timestamp`,
    );
  }
}
