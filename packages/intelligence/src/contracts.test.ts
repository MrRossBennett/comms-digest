import { describe, expect, test } from "vite-plus/test";

import {
  modelExtractionSchema,
  schoolCommunicationSchema,
  validatedExtractionSchema,
} from "./contracts";

const communication = {
  id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b01",
  kind: "email",
  receivedAt: "2026-01-12T16:30:00.000Z",
  householdTimezone: "Europe/London",
  subject: "Year 4 swimming",
  sourceText: "Year 4 swimming starts on Monday 19 January. Please pay £12 by Friday 16 January.",
};

describe("intelligence contracts", () => {
  test("accept the School Communication and extraction shapes used by the swimming workflow", () => {
    expect(() => schoolCommunicationSchema.parse(communication)).not.toThrow();

    expect(() =>
      modelExtractionSchema.parse({
        claims: [
          {
            content: "Year 4 swimming starts on 19 January 2026.",
            audience: { scope: "group", originalWording: "Year 4" },
            certainty: "confirmed",
            date: {
              originalWording: "Monday 19 January",
              resolvedDate: "2026-01-19",
            },
            citations: [
              {
                quote: "Year 4 swimming starts on Monday 19 January.",
                start: 0,
                end: 48,
              },
            ],
          },
        ],
        responsibilities: [
          {
            title: "Pay for Year 4 swimming",
            dueDate: {
              originalWording: "Friday 16 January",
              resolvedDate: "2026-01-16",
            },
            amount: { currency: "GBP", minorUnits: 1200 },
            claimPositions: [0],
          },
        ],
      }),
    ).not.toThrow();
  });

  test("reject malformed validated output that has no Citation or supporting Claim", () => {
    expect(() =>
      validatedExtractionSchema.parse({
        communication,
        claims: [
          {
            id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b02",
            content: "Swimming starts soon.",
            audience: { scope: "group", originalWording: "Year 4" },
            certainty: "confirmed",
            citations: [],
          },
        ],
        responsibilities: [
          {
            id: "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97b03",
            title: "Pay for swimming",
            supportingClaimIds: [],
          },
        ],
      }),
    ).toThrow();
  });

  test("rejects model-invented identifiers", () => {
    expect(() =>
      modelExtractionSchema.parse({
        claims: [
          {
            id: "model-claim-1",
            content: "Swimming starts next Monday.",
            audience: { scope: "group", originalWording: "Year 4" },
            certainty: "confirmed",
            citations: [{ quote: "Swimming starts next Monday.", start: 0, end: 28 }],
          },
        ],
        responsibilities: [],
      }),
    ).toThrow();
  });
});
