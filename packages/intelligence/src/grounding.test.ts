import { expect, test } from "vite-plus/test";

import { GroundingError, validateAndIdentifyExtraction } from "./grounding";

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

test("rejects a model-resolved date that disagrees with deterministic resolution", () => {
  const quote = "Year 4 swimming starts next Monday.";

  expect(() =>
    validateAndIdentifyExtraction(
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
    ),
  ).toThrow(GroundingError);
});

test("rejects Citation offsets that do not identify the exact quote", () => {
  const quote = "Swimming starts Friday.";

  expect(() =>
    validateAndIdentifyExtraction(
      {
        id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
        kind: "email",
        receivedAt: "2026-01-12T16:30:00.000Z",
        householdTimezone: "Europe/London",
        sourceText: `Notice: ${quote}`,
      },
      {
        claims: [
          {
            content: quote,
            audience: { scope: "group", originalWording: "Year 4" },
            certainty: "confirmed",
            citations: [{ quote, start: 0, end: quote.length }],
          },
        ],
        responsibilities: [],
      },
    ),
  ).toThrow(GroundingError);
});

test("rejects a Responsibility that references a missing Claim position", () => {
  expect(() =>
    validateAndIdentifyExtraction(
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
    ),
  ).toThrow(GroundingError);
});
