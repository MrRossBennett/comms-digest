import { expect, test } from "vite-plus/test";

import { modelExtractionSchema } from "./contracts";
import { alignExtractionCitations, validateAndIdentifyExtraction } from "./grounding";

function modelExtraction(quote: string, start: number, end: number) {
  return modelExtractionSchema.parse({
    claims: [
      {
        content: "A claim",
        audience: { scope: "group", originalWording: "Year 4" },
        certainty: "confirmed",
        citations: [{ quote, start, end }],
      },
    ],
    responsibilities: [],
  });
}

test("alignExtractionCitations re-derives offsets from the verbatim quote", () => {
  const sourceText = "Dear Year 4 families, swimming starts next Monday.";
  const quote = "swimming starts next Monday.";

  // Model copied the quote correctly but reported the wrong offsets.
  const aligned = alignExtractionCitations(sourceText, modelExtraction(quote, 0, quote.length));
  const citation = aligned.claims[0]?.citations[0];

  expect(sourceText.slice(citation!.start, citation!.end)).toBe(quote);
  expect(() =>
    validateAndIdentifyExtraction(
      {
        id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
        kind: "email",
        receivedAt: "2026-01-12T16:30:00.000Z",
        householdTimezone: "Europe/London",
        sourceText,
      },
      aligned,
    ),
  ).not.toThrow();
});

test("alignExtractionCitations snaps to the occurrence nearest the model's offset hint", () => {
  const sourceText = "Year 4 swimming. Year 4 payment.";
  const quote = "Year 4";

  // Two occurrences (offsets 0 and 17); the hint points at the second.
  const aligned = alignExtractionCitations(
    sourceText,
    modelExtraction(quote, 16, 16 + quote.length),
  );
  expect(aligned.claims[0]?.citations[0]?.start).toBe(17);
});

test("alignExtractionCitations grounds whitespace-normalized quotes to the exact source passage", () => {
  const sourceText =
    "The children should bring:\n\n  • a water bottle\n  • a packed lunch\u00a0on Monday.";
  const modelQuote = "The children should bring: • a water bottle • a packed lunch on Monday.";

  const aligned = alignExtractionCitations(
    sourceText,
    modelExtraction(modelQuote, 0, modelQuote.length),
  );
  const citation = aligned.claims[0]?.citations[0];

  expect(citation?.quote).toBe(sourceText);
  expect(citation?.start).toBe(0);
  expect(citation?.end).toBe(sourceText.length);
  expect(sourceText.slice(citation!.start, citation!.end)).toBe(citation?.quote);
});

test("validateAndIdentifyExtraction aligns citations even when the caller has not", () => {
  const sourceText = "Please return the form\nby Friday.";
  const modelQuote = "Please return the form by Friday.";

  const result = validateAndIdentifyExtraction(
    {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
      kind: "email",
      receivedAt: "2026-01-12T16:30:00.000Z",
      householdTimezone: "Europe/London",
      sourceText,
    },
    modelExtraction(modelQuote, 151, 289),
  );

  expect(result.claims[0]?.citations[0]).toMatchObject({
    quote: sourceText,
    start: 0,
    end: sourceText.length,
  });
});

test("alignExtractionCitations leaves a changed quote unchanged for the gate to reject", () => {
  const sourceText = "Swimming starts on Monday.";
  const quote = "Swimming starts on Tuesday."; // paraphrased — not a substring

  const aligned = alignExtractionCitations(sourceText, modelExtraction(quote, 0, quote.length));
  expect(aligned.claims[0]?.citations[0]).toMatchObject({ quote, start: 0, end: quote.length });
});

test("grounds model output and maps Responsibility Claim positions to application IDs", () => {
  const ids = [
    "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b02",
    "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b03",
    "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b04",
  ];
  const sourceText =
    "Year 4 swimming starts on Monday 19 January. Please pay £12 by Friday 16 January.";
  const quote = "Year 4 swimming starts on Monday 19 January.";

  const result = validateAndIdentifyExtraction(
    {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
      kind: "email",
      receivedAt: "2026-01-12T16:30:00.000Z",
      householdTimezone: "Europe/London",
      subject: "Year 4 swimming",
      sourceText,
    },
    {
      claims: [
        {
          content: "Year 4 swimming starts on 19 January 2026.",
          audience: { scope: "group", originalWording: "Year 4" },
          certainty: "confirmed",
          date: {
            originalWording: "Monday 19 January",
            resolvedDate: "2026-01-19",
          },
          citations: [{ quote, start: 0, end: quote.length }],
        },
      ],
      responsibilities: [
        {
          title: "Pay for Year 4 swimming",
          amount: { currency: "GBP", minorUnits: 1200 },
          claimPositions: [0],
        },
      ],
    },
    () => {
      const id = ids.shift();
      if (!id) throw new Error("Test ID sequence exhausted");
      return id;
    },
  );

  expect(result.claims[0]?.citations[0]).toMatchObject({
    id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b02",
    communicationId: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
    quote,
  });
  expect(result.claims[0]?.id).toBe("018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b03");
  expect(result.responsibilities[0]).toMatchObject({
    id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b04",
    supportingClaimIds: ["018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b03"],
  });
});

test("replaces a model-resolved date with deterministic resolution", () => {
  const quote = "Year 4 swimming starts next Monday.";

  const result = validateAndIdentifyExtraction(
    {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
      kind: "email",
      receivedAt: "2026-01-12T16:30:00.000Z",
      householdTimezone: "Europe/London",
      sourceText: quote,
    },
    {
      claims: [
        {
          content: "Year 4 swimming starts next Monday.",
          audience: { scope: "group", originalWording: "Year 4" },
          certainty: "confirmed",
          date: {
            originalWording: "next Monday",
            resolvedDate: "2026-01-26",
          },
          citations: [{ quote, start: 0, end: quote.length }],
        },
      ],
      responsibilities: [],
    },
  );

  expect(result.claims[0]?.date).toEqual({
    originalWording: "next Monday",
    resolvedDate: "2026-01-19",
  });
});

test("normalizes an explicit next weekday and ordinal date from a real communication", () => {
  const quote = "The trip is next Wednesday 17th June.";

  const result = validateAndIdentifyExtraction(
    {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
      kind: "email",
      receivedAt: "2026-06-12T14:43:53.000Z",
      householdTimezone: "Europe/London",
      sourceText: quote,
    },
    {
      claims: [
        {
          content: "The trip is on 17 June 2026.",
          audience: { scope: "group", originalWording: "Year 4" },
          certainty: "confirmed",
          date: {
            originalWording: "next Wednesday 17th June",
            resolvedDate: "2026-06-24",
          },
          citations: [{ quote, start: 0, end: quote.length }],
        },
      ],
      responsibilities: [],
    },
  );

  expect(result.claims[0]?.date).toEqual({
    originalWording: "next Wednesday 17th June",
    resolvedDate: "2026-06-17",
  });
});

test("clears an invented date when the wording cannot be resolved deterministically", () => {
  const quote = "The trip is near the end of term.";

  const result = validateAndIdentifyExtraction(
    {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
      kind: "email",
      receivedAt: "2026-01-12T16:30:00.000Z",
      householdTimezone: "Europe/London",
      sourceText: quote,
    },
    {
      claims: [
        {
          content: quote,
          audience: { scope: "group", originalWording: "Year 4" },
          certainty: "confirmed",
          date: {
            originalWording: "near the end of term",
            resolvedDate: "2026-02-13",
          },
          citations: [{ quote, start: 0, end: quote.length }],
        },
      ],
      responsibilities: [],
    },
  );

  expect(result.claims[0]?.date).toEqual({
    originalWording: "near the end of term",
    resolvedDate: null,
  });
});

test("drops a Claim whose Citation wording is not present in the source", () => {
  const sourceQuote = "Swimming starts Friday.";
  const modelQuote = "Swimming starts Thursday.";

  const result = validateAndIdentifyExtraction(
    {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
      kind: "email",
      receivedAt: "2026-01-12T16:30:00.000Z",
      householdTimezone: "Europe/London",
      sourceText: `Notice: ${sourceQuote}`,
    },
    {
      claims: [
        {
          content: modelQuote,
          audience: { scope: "group", originalWording: "Year 4" },
          certainty: "confirmed",
          citations: [{ quote: modelQuote, start: 0, end: modelQuote.length }],
        },
      ],
      responsibilities: [],
    },
  );

  expect(result.claims).toEqual([]);
});

test("keeps grounded Claims and remaps supported Responsibilities when another Claim is dropped", () => {
  const sourceText = "Swimming starts Friday. Bring a towel.";
  const swimmingQuote = "Swimming starts Friday.";
  const unsupportedQuote = "Lunch is provided.";

  const result = validateAndIdentifyExtraction(
    {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
      kind: "email",
      receivedAt: "2026-01-12T16:30:00.000Z",
      householdTimezone: "Europe/London",
      sourceText,
    },
    {
      claims: [
        {
          content: unsupportedQuote,
          audience: { scope: "group", originalWording: "Year 4" },
          certainty: "confirmed",
          citations: [{ quote: unsupportedQuote, start: 0, end: unsupportedQuote.length }],
        },
        {
          content: swimmingQuote,
          audience: { scope: "group", originalWording: "Year 4" },
          certainty: "confirmed",
          citations: [{ quote: swimmingQuote, start: 0, end: swimmingQuote.length }],
        },
      ],
      responsibilities: [
        { title: "Unsupported task", claimPositions: [0] },
        { title: "Prepare for swimming", claimPositions: [1] },
      ],
    },
  );

  expect(result.claims).toHaveLength(1);
  expect(result.claims[0]?.content).toBe(swimmingQuote);
  expect(result.responsibilities).toHaveLength(1);
  expect(result.responsibilities[0]?.title).toBe("Prepare for swimming");
  expect(result.responsibilities[0]?.supportingClaimIds).toEqual([result.claims[0]?.id]);
});

test("drops a Responsibility that references no grounded Claim", () => {
  const result = validateAndIdentifyExtraction(
    {
      id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
      kind: "email",
      receivedAt: "2026-01-12T16:30:00.000Z",
      householdTimezone: "Europe/London",
      sourceText: "Please pay £12 by Friday.",
    },
    {
      claims: [],
      responsibilities: [
        {
          title: "Pay £12",
          claimPositions: [0],
        },
      ],
    },
  );

  expect(result.responsibilities).toEqual([]);
});
