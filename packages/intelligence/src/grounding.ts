import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import {
  modelExtractionSchema,
  schoolCommunicationSchema,
  validatedExtractionSchema,
} from "./contracts";
import { resolveRelativeDate } from "./dates";

const generatedIdSchema = z.uuid();

export class GroundingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroundingError";
  }
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
