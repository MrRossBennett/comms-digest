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
  const normalizedSource = normalizeWhitespaceWithOffsets(sourceText);

  return {
    ...extraction,
    claims: extraction.claims.map((claim) => ({
      ...claim,
      citations: claim.citations.map((citation) => {
        const exactOccurrences = findOccurrences(sourceText, citation.quote);
        if (exactOccurrences.length > 0) {
          const start = nearestOccurrence(exactOccurrences, citation.start);
          return { ...citation, start, end: start + citation.quote.length };
        }

        const normalizedQuote = normalizeWhitespace(citation.quote);
        if (!normalizedQuote) {
          return citation;
        }

        const normalizedOccurrences = findOccurrences(normalizedSource.text, normalizedQuote)
          .map((index) => {
            const start = normalizedSource.starts[index];
            const end = normalizedSource.ends[index + normalizedQuote.length - 1];
            return start === undefined || end === undefined ? undefined : { start, end };
          })
          .filter((occurrence) => occurrence !== undefined);
        if (normalizedOccurrences.length === 0) {
          return citation;
        }

        const occurrence = normalizedOccurrences.reduce((best, candidate) =>
          Math.abs(candidate.start - citation.start) < Math.abs(best.start - citation.start)
            ? candidate
            : best,
        );

        return {
          ...citation,
          quote: sourceText.slice(occurrence.start, occurrence.end),
          start: occurrence.start,
          end: occurrence.end,
        };
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
  const modelExtraction = alignExtractionCitations(
    communication.sourceText,
    modelExtractionSchema.parse(extractionInput),
  );
  const claimPositionMap = new Map<number, number>();
  const groundedClaims = modelExtraction.claims.flatMap((claim, originalPosition) => {
    const citations = claim.citations.filter((citation) =>
      citationIdentifiesExactQuote(communication.sourceText, citation),
    );
    if (citations.length === 0) return [];

    claimPositionMap.set(originalPosition, claimPositionMap.size);
    return [{ ...claim, citations }];
  });
  const extraction = {
    ...modelExtraction,
    claims: groundedClaims.map((claim) => ({
      ...claim,
      date: claim.date
        ? normalizeResolvedDate(
            claim.date,
            communication.receivedAt,
            communication.householdTimezone,
          )
        : undefined,
    })),
    responsibilities: modelExtraction.responsibilities.flatMap((responsibility) => {
      const claimPositions = responsibility.claimPositions.flatMap((position) => {
        const mappedPosition = claimPositionMap.get(position);
        return mappedPosition === undefined ? [] : [mappedPosition];
      });
      if (claimPositions.length === 0) return [];

      return [
        {
          ...responsibility,
          claimPositions,
          dueDate: responsibility.dueDate
            ? normalizeResolvedDate(
                responsibility.dueDate,
                communication.receivedAt,
                communication.householdTimezone,
              )
            : undefined,
        },
      ];
    }),
  };

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

function normalizeResolvedDate(
  date: { originalWording: string },
  receivedAt: string,
  householdTimezone: string,
) {
  return resolveRelativeDate(date.originalWording, receivedAt, householdTimezone);
}

function citationIdentifiesExactQuote(
  sourceText: string,
  citation: { quote: string; start: number; end: number },
) {
  return sourceText.slice(citation.start, citation.end) === citation.quote;
}

function findOccurrences(text: string, search: string) {
  const occurrences: number[] = [];
  for (let index = text.indexOf(search); index !== -1; index = text.indexOf(search, index + 1)) {
    occurrences.push(index);
  }
  return occurrences;
}

function nearestOccurrence(occurrences: number[], hint: number) {
  return occurrences.reduce((best, candidate) =>
    Math.abs(candidate - hint) < Math.abs(best - hint) ? candidate : best,
  );
}

function normalizeWhitespace(text: string) {
  return text.trim().replace(/\s+/gu, " ");
}

function normalizeWhitespaceWithOffsets(text: string) {
  let normalized = "";
  const starts: number[] = [];
  const ends: number[] = [];

  for (let index = 0; index < text.length; ) {
    if (/\s/u.test(text[index] ?? "")) {
      const start = index;
      while (index < text.length && /\s/u.test(text[index] ?? "")) index += 1;
      normalized += " ";
      starts.push(start);
      ends.push(index);
      continue;
    }

    normalized += text[index];
    starts.push(index);
    index += 1;
    ends.push(index);
  }

  return { text: normalized, starts, ends };
}
